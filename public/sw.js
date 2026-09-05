// Hand-rolled service worker (no Serwist/Workbox): @serwist/next's Next.js
// integration only supports webpack, and this project builds with
// Turbopack (Next 16 default) for both `next dev` and `next build`. The
// PWA needs here are narrow enough — precache-as-you-go for the app shell,
// network-first for one API route — that a small vanilla worker is simpler
// than fighting that incompatibility. Bump CACHE_VERSION on breaking
// changes to force old caches to be dropped.
// Renamed from "pdc26-*" now that this app hosts more than one festival —
// bumped to v4 (was pdc26-v3) so the rename itself also drops old caches.
const CACHE_VERSION = "horarios-v4";
const SCHEDULE_CACHE = `${CACHE_VERSION}-schedule`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const CURRENT_CACHES = [SCHEDULE_CACHE, ASSET_CACHE];

// The page that triggers SW registration is fetched before the worker can
// intercept anything, so without an explicit precache here, a user who
// loads the app once and goes straight offline would have no cached page to
// fall back to on their next visit. "/pdc26" is the currently-installable
// festival (and the manifest's start_url); "/" is the archive index a
// visitor may also have open. A future festival's route isn't known to this
// static file at build time, so precaching it here needs a matching edit —
// the rest of the app still works offline without it, just without this
// as-you-install head start.
const SHELL_URLS = ["/", "/pdc26", "/manifest.webmanifest"];
const SCHEDULE_URLS = ["/api/festivals/pdc26/schedule"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(ASSET_CACHE).then((cache) => cache.addAll(SHELL_URLS)),
      // Also fetched by the page itself on mount, but that fetch races SW
      // activation on a first-ever visit and can miss the cache. Fetching
      // it here too closes that gap deterministically.
      caches.open(SCHEDULE_CACHE).then((cache) => cache.addAll(SCHEDULE_URLS)),
    ]),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            // Matches both this app's current prefix and its old "pdc26-*"
            // one, so the v3->v4 rename above actually cleans up the caches
            // it's replacing instead of leaving them orphaned.
            .filter((key) => /^(horarios|pdc26)-/.test(key) && !CURRENT_CACHES.includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);

  return cached ?? (await networkPromise) ?? Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Live data: try the network first so admin edits show up immediately;
  // fall back to the last-cached response when offline. Matches
  // /api/festivals/<slug>/schedule for any festival, not just the one
  // precached above.
  if (/^\/api\/festivals\/[^/]+\/schedule$/.test(url.pathname)) {
    event.respondWith(networkFirst(request, SCHEDULE_CACHE));
    return;
  }

  // HTML documents must be network-first, not stale-while-revalidate. The
  // document is what names the hashed bundle URLs for the current build, so
  // serving a stale copy pins the visitor to the *previous* deploy's entire
  // JS/CSS set — the revalidate only lands in the cache for the load after
  // this one. That left every deploy invisible until the app was opened
  // twice, which made shipped fixes look like they had never deployed.
  // Offline still works: this falls back to the cached document.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, ASSET_CACHE));
    return;
  }

  // Hashed JS/CSS bundles and icons are content-addressed — a given URL's
  // bytes never change — so serving them from cache instantly is safe and
  // is what makes repeat loads feel instant.
  event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
});
