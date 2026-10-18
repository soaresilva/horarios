// Network side of the Le Guess Who? importer. Everything here is I/O; the
// parsing it feeds is in parse.ts and is tested without a network.
//
// leguesswho.com/timetable (and /u/timetable for U?) renders only the first
// day. The other days load when a visitor taps a day tab, which makes a
// Livewire `setDay('YYYY-MM-DD')` call: a POST to the component's update
// endpoint carrying the page's snapshot and CSRF token. `?day=` in the URL
// is ignored (checked 2026-10-18). So this replays exactly that tap, once
// per day, with the session cookie the GET handed out. It reads nothing a
// visitor's browser doesn't, and changes no server state.
//
// robots.txt (2026-10-18): `Disallow:` (nothing) and `Crawl-delay: 5`, so
// every request waits 5s after the previous one. A full fetch is ~6
// timetable requests plus one per venue page with --venues.

const SITE = "https://leguesswho.com";
const USER_AGENT = "horarios-importer (+https://github.com/soaresilva/horarios)";
export const CRAWL_DELAY_MS = 5_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class FetchStopped extends Error {}

let lastRequestAt = 0;
async function politely<T>(run: () => Promise<T>): Promise<T> {
  const wait = lastRequestAt + CRAWL_DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  try {
    return await run();
  } finally {
    lastRequestAt = Date.now();
  }
}

function check(response: Response, url: string) {
  // 419 is Laravel's "page expired" (stale CSRF/session); 429 is "slow
  // down". Neither is retried: the first means the replay is wrong, the
  // second means stop.
  if (response.status === 419 || response.status === 429) {
    throw new FetchStopped(`${response.status} from ${url}; stopping.`);
  }
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} from ${url}`);
}

export async function fetchPage(path: string): Promise<string> {
  const url = `${SITE}${path}`;
  return politely(async () => {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    check(response, url);
    return response.text();
  });
}

const decodeAttr = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** The `timetable` component's snapshot string from a page's HTML (the login widgets carry their own). */
export function timetableSnapshotFrom(html: string): string {
  for (const match of html.matchAll(/wire:snapshot="([^"]*)"/g)) {
    const raw = decodeAttr(match[1]);
    const parsed = JSON.parse(raw) as { memo?: { name?: string } };
    if (parsed.memo?.name === "timetable") return raw;
  }
  throw new Error('No Livewire "timetable" component on the page; has the site changed?');
}

/** The `data` half of every day's snapshot for one timetable page, keyed by day id. */
export async function fetchTimetableDays(path: string, daysOf: (data: unknown) => string[]): Promise<Record<string, unknown>> {
  const url = `${SITE}${path}`;
  const first = await politely(async () => {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    check(response, url);
    return { html: await response.text(), cookies: response.headers.getSetCookie() };
  });

  const csrf = first.html.match(/<meta name="csrf-token" content="([^"]+)"/)?.[1];
  const updateUri = first.html.match(/data-update-uri="([^"]+)"/)?.[1];
  if (!csrf || !updateUri) throw new Error(`${path}: no CSRF token or Livewire update URI on the page.`);
  // Name=value only; attributes (path, expiry, HttpOnly) are for browsers.
  const cookie = first.cookies.map((c) => c.split(";")[0]).join("; ");

  const snapshot = timetableSnapshotFrom(first.html);
  const initial = (JSON.parse(snapshot) as { data: unknown }).data;
  const days = daysOf(initial);
  const byDay: Record<string, unknown> = { [days[0]]: initial };

  for (const day of days.slice(1)) {
    const body = JSON.stringify({
      _token: csrf,
      components: [{ snapshot, updates: {}, calls: [{ path: "", method: "setDay", params: [day] }] }],
    });
    const result = await politely(async () => {
      const response = await fetch(updateUri, {
        method: "POST",
        headers: {
          "User-Agent": USER_AGENT,
          "Content-Type": "application/json",
          "X-Livewire": "",
          "X-CSRF-TOKEN": csrf,
          Cookie: cookie,
        },
        body,
      });
      check(response, updateUri);
      return (await response.json()) as { components?: { snapshot: string }[] };
    });
    const next = result.components?.[0]?.snapshot;
    if (!next) throw new Error(`${path} setDay(${day}): no snapshot in the response.`);
    byDay[day] = (JSON.parse(next) as { data: unknown }).data;
  }
  return byDay;
}
