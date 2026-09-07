// Polite fetching for the Left of the Dial importer.
//
// leftofthedial.nl's robots.txt disallows only /backstage/, so the act pages
// are fair game — but that's a floor, not a licence. Requests are sequential
// with a delay between them: ~160 pages at 400ms is under two minutes, and
// being faster isn't worth being a nuisance to a small festival's server.

const USER_AGENT = "horarios-importer (+https://github.com/soaresilva/horarios)";
const DELAY_MS = 400;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class RateLimitedError extends Error {}

/**
 * One GET, with a single retry on a network error or 5xx.
 *
 * A 429 aborts the whole run rather than retrying: being told to slow down
 * and immediately asking again is the opposite of what it means.
 */
export async function politeFetch(url: string, attempt = 1): Promise<string> {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } }).catch((err: unknown) => {
    if (attempt >= 2) throw err;
    return null;
  });

  if (response === null) {
    await sleep(DELAY_MS * 4);
    return politeFetch(url, attempt + 1);
  }

  if (response.status === 429) {
    throw new RateLimitedError(`429 from ${url} — stopping rather than hammering the server.`);
  }

  if (response.status >= 500 && attempt < 2) {
    await sleep(DELAY_MS * 4);
    return politeFetch(url, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} from ${url}`);
  }

  return response.text();
}

/** Fetch each URL in turn, pausing between requests. */
export async function fetchSequentially<T>(
  urls: string[],
  handle: (html: string, url: string, index: number) => T,
  onProgress?: (done: number, total: number) => void,
): Promise<T[]> {
  const results: T[] = [];
  for (const [index, url] of urls.entries()) {
    if (index > 0) await sleep(DELAY_MS);
    results.push(handle(await politeFetch(url), url, index));
    onProgress?.(index + 1, urls.length);
  }
  return results;
}
