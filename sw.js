// Çevrimdışı çalışma: uygulama dosyaları ilk açılışta önbelleğe alınır.
// Sürüm değişince eski önbellek silinir (CACHE adını derleme değiştirir).
const CACHE = "etkilit-mobil-__BUILD__";
const FILES = [
  "./",
  "index.html",
  "app.js",
  "crypto.js",
  "style.css",
  "manifest.webmanifest",
  "vendor/jsQR.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("etkilit-mobil-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Önce ağ (güncel sürüm), ağ yoksa önbellek
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
  );
});
