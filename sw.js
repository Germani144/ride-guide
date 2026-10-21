// Offline support.
//
// Several apps live on the same origin (germani144.github.io/<app>/) and share one CacheStorage.
// So this worker only ever creates, reads and deletes caches whose name starts with PREFIX,
// and only handles requests inside its own folder.
//
// Strategy: network first, so a change shows up on the next open; the cached copy is the
// fallback when offline or when the network is too slow. Bump the version in src/version.js when shipping changes.
importScripts('./src/version.js'); // sets self.RIDEGUIDE_VERSION
const PREFIX = 'rideguide-';
const CACHE = `${PREFIX}v${self.RIDEGUIDE_VERSION}`; // a new version gets a fresh cache
const NETWORK_TIMEOUT_MS = 4000;
const SHELL = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './src/version.js', './src/app.js', './src/engine.js', './src/model.js', './src/storage.js', './src/i18n.js',
  './src/seed.js', './src/ui.js', './src/views/wizard.js', './src/views/cars.js', './src/views/settings.js',
  './fonts/barlow-latin-400-normal.woff2', './fonts/barlow-latin-500-normal.woff2',
  './fonts/barlow-latin-600-normal.woff2', './fonts/barlow-condensed-latin-600-normal.woff2',
  './fonts/barlow-condensed-latin-700-normal.woff2',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
];

const SCOPE = self.registration.scope; // e.g. https://germani144.github.io/ride-guide/

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's HTTP cache, so the shell is the version just deployed.
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

async function fromNetwork(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), NETWORK_TIMEOUT_MS);
  try {
    // no-cache: revalidate with the server instead of trusting GitHub Pages' 10-minute max-age.
    const res = await fetch(url, { cache: 'no-cache', credentials: 'same-origin', signal: ctrl.signal });
    if (res.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(url, res.clone());
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fromCache(url, isPage) {
  const cache = await caches.open(CACHE);
  return (await cache.match(url, { ignoreSearch: true }))
    || (isPage ? cache.match(new URL('./index.html', SCOPE).href) : undefined);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(SCOPE)) return; // not ours: leave it alone
  const url = req.url.split('#')[0];
  const isPage = req.mode === 'navigate';
  e.respondWith(
    fromNetwork(url).catch(async () => (await fromCache(url, isPage)) || Response.error()),
  );
});
