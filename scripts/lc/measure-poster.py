"""Check the London Calling snapshot against the poster images, pixel by pixel.

London Calling publishes its timetable only as two JPG posters (one per day,
three room columns each, every set a black rounded box on a lime grid). The
band times in scripts/data/lc26oct.json are transcribed from the printed
"HH.MM-HH.MM" labels, which is latent work and can be misread. This script
is the deterministic check on that, and the only source for the two club
nights, whose boxes carry no printed times:

1. Find every black box in each room column by scanning down a thin strip
   just inside the boxes' shared left edge (left of any text).
2. Pair the boxes with the snapshot's sets for that day and room, in time
   order. A count mismatch means a set was missed or invented: hard fail.
3. Fit the poster's time axis (minutes = slope * y + offset) by least
   squares over every band set's printed start (box top) and end (box
   bottom). Box tops and bottoms get separate offsets, because the rounded
   corners eat the same few pixels at both ends of every box.
4. Report each band set's residual (printed time vs. where its box actually
   sits). Anything over MAX_RESIDUAL minutes is a transcription error: hard
   fail. (Club-night times inherit the same few minutes of drift.)
5. Print the fitted start/end of each club night, rounded to 5 minutes. A
   box that runs off the bottom of the poster ends at the poster edge,
   which is what "match the poster" means for Saturday's Indiesleaze.

Run it after any poster revision and copy the club times into the snapshot:

    python3 -m venv /tmp/lc-venv && /tmp/lc-venv/bin/pip install pillow
    /tmp/lc-venv/bin/python -I scripts/lc/measure-poster.py \\
        scripts/data/lc26oct.json path/to/page-0001-scaled.jpg path/to/page-0002-scaled.jpg

Pillow isn't a project dependency on purpose, same as pdfplumber for
scripts/touo/extract-pdf.py: this runs once per poster revision, not in the
app or in CI.
"""

import json
import sys

from PIL import Image

DAYS = ("FRIDAY", "SATURDAY")
# Room columns as fractions of the poster width, between the vertical
# divider lines and clear of the time labels on the far left.
COLUMNS = {
    "small-hall": (0.105, 0.385),
    "main-hall": (0.395, 0.675),
    "third": (0.685, 0.99),  # De Kring on Friday, Barlaeus on Saturday
}
DARK = 80  # 0-255 luminance; box fill is ~0, the lime grid is ~190
# Minutes. The printed labels are authoritative; the boxes are hand-placed and
# drift from them by up to 8.2 min on the October 2026 posters (Momo Boyd's
# box starts at 15:48 for a printed 15.40, checked by eye). 10 min still
# catches a misread digit, which is 10+ min off by construction.
MAX_RESIDUAL = 10.0
ROLL_HOUR = 6  # same boundary as FESTIVAL_DAY_ROLL_HOUR in src/lib/time.ts


def to_minutes(hhmm):
    h, m = map(int, hhmm.split(":"))
    if h < ROLL_HOUR:
        h += 24
    return h * 60 + m


def to_hhmm(minutes):
    minutes = int(round(minutes))
    return f"{(minutes // 60) % 24:02d}:{minutes % 60:02d}"


def column_of(stage):
    return stage if stage in ("small-hall", "main-hall") else "third"


def grid_span(px, w, h):
    """(top, bottom) of the grid: the longest dark vertical run of the divider
    line between the first two room columns. Everything above it (the day
    title, the room-name pills) and below it (Friday's logo) is artwork."""
    best = (0, 0)
    for x in range(int(0.38 * w), int(0.40 * w)):
        start = None
        for y in range(h + 1):
            dark = y < h and px[x, y] < DARK
            if dark and start is None:
                start = y
            elif not dark and start is not None:
                if y - start > best[1] - best[0]:
                    best = (start, y)
                start = None
    return best


def find_boxes(px, w, h, lo, hi, span):
    """(top, bottom) pixel rows of every black box in one room column."""
    x0, x1 = int(lo * w), int(hi * w)
    # The boxes in a column share one left edge, so the x with the most dark
    # pixels down the page (after the grid lines, which span every column
    # equally) is that edge.
    counts = [sum(1 for y in range(0, h, 2) if px[x, y] < DARK) for x in range(x0, x1)]
    peak = max(counts)
    edge = x0 + next(i for i, c in enumerate(counts) if c >= 0.6 * peak)
    probe = [edge + int(0.006 * w) + k for k in range(3)]

    boxes, start = [], None
    # A 30-min box is ~3% of the poster height; grid lines and the outlined
    # room-name pills are well under 2%.
    min_len = int(0.02 * h)
    grid_top, grid_bottom = span
    for y in range(grid_top, h):
        dark = all(px[x, y] < DARK for x in probe)
        if dark and start is None:
            start = y
        elif not dark and start is not None:
            if y - start >= min_len and start < grid_bottom:
                boxes.append((start, y - 1))
            start = None
    # Saturday's last box runs off the bottom of the poster.
    if start is not None and h - start >= min_len and start < grid_bottom:
        boxes.append((start, h - 1))
    return boxes


def fit(points):
    """Least squares for minutes = a*y + (b_top | b_bottom)."""
    # Normal equations for three unknowns, solved by hand to stay dependency-free.
    sxx = sx_t = sx_b = n_t = n_b = sxy = sy_t = sy_b = 0.0
    for y, minutes, is_top in points:
        sxx += y * y
        sxy += y * minutes
        if is_top:
            sx_t += y; n_t += 1; sy_t += minutes
        else:
            sx_b += y; n_b += 1; sy_b += minutes
    # Eliminate the two offsets: b_t = (sy_t - a*sx_t)/n_t, same for b_b.
    a = (sxy - sx_t * sy_t / n_t - sx_b * sy_b / n_b) / (sxx - sx_t ** 2 / n_t - sx_b ** 2 / n_b)
    return a, (sy_t - a * sx_t) / n_t, (sy_b - a * sx_b) / n_b


def main(snapshot_path, *posters):
    snapshot = json.load(open(snapshot_path, encoding="utf8"))
    failures = []

    for day, poster in zip(DAYS, posters):
        img = Image.open(poster).convert("L")
        w, h = img.size
        px = img.load()
        span = grid_span(px, w, h)
        pairs = []  # (set, top, bottom)
        for col, (lo, hi) in COLUMNS.items():
            sets = sorted(
                (s for s in snapshot["sets"] if s["day"] == day and column_of(s["stage"]) == col),
                key=lambda s: to_minutes(s["start"]),
            )
            boxes = find_boxes(px, w, h, lo, hi, span)
            if len(boxes) != len(sets):
                failures.append(f"{day} {col}: poster has {len(boxes)} boxes, snapshot has {len(sets)} sets")
                continue
            pairs += [(s, t, b) for s, (t, b) in zip(sets, boxes)]

        points = []
        for s, top, bottom in pairs:
            if s["kind"] == "band":
                points.append((top, to_minutes(s["start"]), True))
                points.append((bottom, to_minutes(s["end"]), False))
        if not points:
            continue
        a, b_top, b_bottom = fit(points)
        print(f"\n{day}: axis {1 / a:.2f} px/min, grid rows {span[0]}-{span[1]} of {h}")

        for s, top, bottom in sorted(pairs, key=lambda p: (p[0]["stage"], p[1])):
            fitted_start = a * top + b_top
            fitted_end = a * bottom + b_bottom
            if s["kind"] == "band":
                rs = fitted_start - to_minutes(s["start"])
                re = fitted_end - to_minutes(s["end"])
                flag = "" if max(abs(rs), abs(re)) <= MAX_RESIDUAL else "  <-- MISMATCH"
                print(f"  {s['stage']:<11} {s['name']:<22} {s['start']}-{s['end']}  residual {rs:+.1f}/{re:+.1f} min{flag}")
                if flag:
                    failures.append(f"{day} {s['name']}: printed {s['start']}-{s['end']}, box sits at {to_hhmm(fitted_start)}-{to_hhmm(fitted_end)}")
            else:
                clipped = bottom >= h - 2
                start = 5 * round(fitted_start / 5)
                # A box running off the poster ends at the edge: round down,
                # never past what the poster actually shows.
                end = 5 * (int(fitted_end) // 5) if clipped else 5 * round(fitted_end / 5)
                edge = " (runs off the poster edge)" if clipped else ""
                print(f"  {s['stage']:<11} {s['name'][:22]:<22} measured {to_hhmm(start)}-{to_hhmm(end)}{edge}"
                      f"  [raw {fitted_start:.1f}/{fitted_end:.1f}]  snapshot has {s['start']}-{s['end']}")
                if (to_hhmm(start), to_hhmm(end)) != (s["start"], s["end"]):
                    failures.append(f"{day} {s['name']}: snapshot {s['start']}-{s['end']}, poster measures {to_hhmm(start)}-{to_hhmm(end)}")

    if failures:
        print("\nFAILED:\n  " + "\n  ".join(failures))
        sys.exit(1)
    print("\nOK: every box accounted for, every printed time matches its box.")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])
