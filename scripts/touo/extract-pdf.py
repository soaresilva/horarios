"""Extract The Official Unofficial 2026 timetable from its one-page PDF.

The side programme publishes no API, only an A4 PDF grid
(https://www.theofficialunofficial.nl/wp-content/uploads/2026/10/A4-TOUO-Timetable.pdf).
Reading times off that image by eye is exactly the kind of work that should
be code, so this reads the PDF's vector layout instead:

- every set is a filled rectangle inside the grid (yellow for bands, pink
  for the two non-band activities);
- the time axis is a run of 10-minute columns, 12:00 at x=192.22 with
  14.026pt per column on both days. Saturday adds one narrower 11:45 column
  that starts at x=173.4, so x positions left of 12:00 are mapped against
  that column on its own;
- the venue and "HOSTED BY" labels sit in the left column at the row's y.

Output is printed as JSON (sets only, sorted). scripts/data/touo26.json is
that output plus the hand-entered Sticker Night box, which is a text box
rather than a grid block. Re-run after the PDF changes and diff the result:

    python3 -m venv /tmp/touo-venv && /tmp/touo-venv/bin/pip install pdfplumber
    /tmp/touo-venv/bin/python -I scripts/touo/extract-pdf.py path/to/A4-TOUO-Timetable.pdf

pdfplumber isn't a project dependency on purpose: this runs once per PDF
revision, not in the app or in CI.
"""

import json
import re
import sys

import pdfplumber

X_1200 = 192.22  # centre of the 12:00 tick label == left edge of the 12:00 column
PT_PER_MIN = 14.026 / 10
X_1145 = 173.4  # left edge of Saturday's 11:45 column
GRID_X0, GRID_X1 = 170.0, 531.5
LABEL_X_MAX = 172.0  # label words start left of this; "HARD OF HEARING" overhangs the grid edge
DAY_SPLIT_Y = 400.0  # Friday grid sits above, Saturday below
SNAP_MIN = 5
MAX_SNAP_ERROR_MIN = 1.5  # anything further off-grid than this is a parse bug

# The PDF truncates one name to fit its block; everything else is just
# upper-cased and title-cased below.
PDF_NAME_FIXES = {"SALMON ON A LEAS": "SALMON ON A LEASH"}

# Display names that title-casing gets wrong.
DISPLAY_NAMES = {
    "APR1L": "APR1L",
    "PLEASUREINC.": "PleasureInc.",
    "MF TOMLINSON": "MF Tomlinson",
    "YOO DOO RIGHT": "Yoo Doo Right",
    "CHILD OF PRAGUE": "Child of Prague",
    "FLOWERS FOR THE DEAD": "Flowers for the Dead",
    "SALMON ON A LEASH": "Salmon on a Leash",
    "ELECTRONIC MUSIC WORKSHOP": "Electronic Music Workshop",
    "LINE DANCING CRASH COURSE": "Line Dancing Crash Course",
}

HOST_DISPLAY = {
    "3VOOR12": "3voor12",
    "PLEASUREINC.": "PleasureInc.",
    "BANDS DO BK": "Bands Do BK",
    "BLAB & SERPENTSKIRT": "BLAB & Serpentskirt",
    "SALMON ON A LEASH": "Salmon on a Leash",
    "OUTER TOWN & HARD OF HEARING": "Outer Town & Hard of Hearing",
}


def title(s: str) -> str:
    return " ".join(w[:1].upper() + w[1:].lower() for w in s.split())


def x_to_minutes(x: float) -> float:
    """Minutes after 12:00 (negative before it)."""
    if x < X_1200 - 0.5:
        # Saturday's 11:45 column: 15 minutes squeezed into X_1200 - X_1145.
        return -15 * (X_1200 - x) / (X_1200 - X_1145)
    return (x - X_1200) / PT_PER_MIN


def snap(x: float) -> int:
    raw = x_to_minutes(x)
    snapped = round(raw / SNAP_MIN) * SNAP_MIN
    if abs(raw - snapped) > MAX_SNAP_ERROR_MIN:
        raise SystemExit(f"x={x:.1f} maps to {raw:.2f} min, {abs(raw - snapped):.2f} off the {SNAP_MIN}-min grid")
    return snapped


def hhmm(minutes_after_noon: int) -> str:
    total = 12 * 60 + minutes_after_noon
    return f"{total // 60:02d}:{total % 60:02d}"


def is_block(r) -> bool:
    if not r.get("fill"):
        return False
    w, h = r["x1"] - r["x0"], r["bottom"] - r["top"]
    color = str(r.get("non_stroking_color"))
    return (
        color in ("0.08", "0.57")
        and 20 <= h <= 30
        and w > 20
        and r["x0"] >= GRID_X0
        and r["x1"] <= GRID_X1
    )


def words_in(words, x0, x1, top, bottom):
    inside = [
        w for w in words
        if x0 - 0.5 <= (w["x0"] + w["x1"]) / 2 <= x1 + 0.5 and top - 0.5 <= w["top"] <= bottom
    ]
    inside.sort(key=lambda w: (round(w["top"]), w["x0"]))
    return [w["text"] for w in inside]


def row_label(words, top, bottom):
    label = [w for w in words if w["x0"] < LABEL_X_MAX and top - 1 <= w["top"] <= bottom]
    label.sort(key=lambda w: (round(w["top"]), w["x0"]))
    venue = [w["text"] for w in label if w["size"] > 7.5]
    rest = [w["text"] for w in label if w["size"] <= 7.5]
    sub = " ".join(rest)
    m = re.search(r"HOSTED BY (.+)$", sub)
    host = m.group(1) if m else None
    room = None
    if not m and sub and not sub.startswith("("):
        room = sub  # "TR DOWN" / "TR FOYER" under THEATER ROTTERDAM
    venue_name = " ".join(venue)
    if "(FKA" in sub:
        venue_name += " (FKA CENTRAAL)"
    return (room or venue_name), host


def main(path: str) -> None:
    page = pdfplumber.open(path).pages[0]
    words = page.extract_words(extra_attrs=["size"])
    blocks = [r for r in page.rects if is_block(r)]
    sets = []
    for r in blocks:
        text = words_in(words, r["x0"], r["x1"], r["top"], r["bottom"])
        joined = " ".join(text)
        m = re.match(r"^(.*?)\s*\(([A-Z/]+)\)\s*$", joined)
        name, country = (m.group(1), m.group(2)) if m else (joined, None)
        name = PDF_NAME_FIXES.get(name, name)
        venue, host = row_label(words, r["top"], r["bottom"])
        start, end = snap(r["x0"]), snap(r["x1"])
        sets.append({
            "day": "FRIDAY" if r["top"] < DAY_SPLIT_Y else "SATURDAY",
            "venue": venue,
            "host": HOST_DISPLAY.get(host, title(host)) if host else None,
            "artist": DISPLAY_NAMES.get(name, title(name)),
            "pdfName": name,
            "country": country,
            "start": hhmm(start),
            "end": hhmm(end),
            "kind": "extra" if str(r.get("non_stroking_color")) == "0.57" else "band",
        })
    sets.sort(key=lambda s: (s["day"], s["venue"], s["start"]))
    json.dump(sets, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main(sys.argv[1])
