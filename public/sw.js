// Hand-rolled service worker (no Serwist/Workbox): @serwist/next's Next.js
// integration only supports webpack, and this project builds with
// Turbopack (Next 16 default) for both `next dev` and `next build`. The
// PWA needs here are narrow enough — precache-as-you-go for the app shell,
// network-first for one API route — that a small vanilla worker is simpler
// than fighting that incompatibility. Bump CACHE_VERSION on breaking
// changes to force old caches to be dropped.
// Renamed from "pdc26-*" now that this app hosts more than one festival.
// v5 also evicts schedule responses cached in the pre-zones/artists shape,
// which an offline visitor would otherwise be served with missing arrays.
// v8 adds the London Calling October 2026 route to the precache below.
// v9 adds Le Guess Who? 2026, and Performance.kind to the schedule response.
// v10 drops the stale-while-revalidate copy of the manifest (it pinned
// installs to the old start_url) and stops precaching the now-redirecting "/".
const CACHE_VERSION = "horarios-v10";
const SCHEDULE_CACHE = `${CACHE_VERSION}-schedule`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const CURRENT_CACHES = [SCHEDULE_CACHE, ASSET_CACHE];

// Served when a navigation's network fetch fails AND that exact URL was
// never cached (a returning visitor's still-active old service worker
// hitting a route added after they last opened the app, plus any transient
// fetch failure — an ad-blocker/privacy extension intercepting a
// service-worker-context fetch, not just genuine offline). Without this,
// networkFirst's rethrow makes the *browser* render its own hard
// "can't be reached" page, since a rejected respondWith() is a network
// error as far as the browser is concerned — this never reaches the app's
// own code, so no in-app error handling can catch it either.
const OFFLINE_FALLBACK_URL = "/offline.html";

// The page that triggers SW registration is fetched before the worker can
// intercept anything, so without an explicit precache here, a user who
// loads the app once and goes straight offline would have no cached page to
// fall back to on their next visit. "/pdc26" is the currently-installable
// festival (and the manifest's start_url); "/" is the archive index a
// visitor may also have open. A future festival's route isn't known to this
// static file at build time, so precaching it here needs a matching edit —
// the rest of the app still works offline without it, just without this
// as-you-install head start.
const SHELL_URLS = ["/archive", "/pdc26", "/lotd26", "/lc26oct", "/lgw26", "/manifest.webmanifest", OFFLINE_FALLBACK_URL];
const SCHEDULE_URLS = [
  "/api/festivals/pdc26/schedule",
  "/api/festivals/lotd26/schedule",
  "/api/festivals/lc26oct/schedule",
  "/api/festivals/lgw26/schedule",
];

// "/" redirects to the festival featured in /admin. cache.addAll would store
// the followed (redirected: true) response, which the browser refuses to serve
// to a navigation, so "/" is cached as a synthetic 302 to the final URL
// instead. Offline, that 302 lands on the festival route cached above.
async function fetchRoot(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request.url, { redirect: "follow" });
    if (response.redirected) {
      const redirect = Response.redirect(response.url, 302);
      await cache.put("/", redirect.clone());
      return redirect;
    }
    if (response.ok) await cache.put("/", response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match("/");
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      fetchRoot(new Request("/"), ASSET_CACHE),
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
            // one, so a version bump or rename actually cleans up the caches
            // it replaces instead of leaving them orphaned.
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

async function offlineFallback() {
  const cache = await caches.open(ASSET_CACHE);
  const fallback = await cache.match(OFFLINE_FALLBACK_URL);
  // Falls through to a real network error only if the fallback page itself
  // was never precached (e.g. this exact install is mid-update) — same
  // failure mode as before this fix existed, not a new one.
  return fallback ?? Response.error();
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

  // The manifest carries start_url, which changes when the featured festival
  // does; a cached copy would keep installing the previous edition.
  if (url.pathname === "/manifest.webmanifest") {
    event.respondWith(networkFirst(request, ASSET_CACHE));
    return;
  }

  // HTML documents must be network-first, not stale-while-revalidate. The
  // document is what names the hashed bundle URLs for the current build, so
  // serving a stale copy pins the visitor to the *previous* deploy's entire
  // JS/CSS set — the revalidate only lands in the cache for the load after
  // this one. That left every deploy invisible until the app was opened
  // twice, which made shipped fixes look like they had never deployed.
  // Offline still works: this falls back to the cached document.
  if (request.mode === "navigate" && url.pathname === "/") {
    event.respondWith(fetchRoot(request, ASSET_CACHE).catch(offlineFallback));
    return;
  }
  if (request.mode === "navigate") {
    // Only navigations get the offline-fallback-page safety net: the
    // schedule API's networkFirst above must keep rethrowing on total
    // failure so useSchedule's own "Refresh failed, tap to retry" notice
    // still fires — swallowing that here would hide a real fetch failure
    // behind a silently stale schedule instead.
    event.respondWith(networkFirst(request, ASSET_CACHE).catch(offlineFallback));
    return;
  }

  // Hashed JS/CSS bundles and icons are content-addressed — a given URL's
  // bytes never change — so serving them from cache instantly is safe and
  // is what makes repeat loads feel instant.
  event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
});
