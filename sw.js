/* e-DISIPLIN MURID 2026 — service worker
 *
 * Strategi:
 *  - API Apps Script, log masuk Google dan semua origin lain: TIDAK disentuh (terus ke rangkaian).
 *  - Permintaan bukan GET (POST API): tidak disentuh.
 *  - vendor/ & icons/ (fail berversi, tidak berubah): cache-first.
 *  - Halaman HTML, js/, css/, config.js: network-first, jatuh balik ke cache bila luar talian.
 *    Jadi kemas kini kod sampai kepada pengguna serta-merta tanpa perlu naikkan VERSI.
 *
 * Naikkan VERSI bila menukar fail dalam vendor/ atau icons/, atau senarai KULIT.
 * Data laporan murid TIDAK PERNAH disimpan dalam cache (ia datang melalui POST ke Apps Script).
 */
const VERSI = 'edisiplin-v1';

const KULIT = [
  './', './index.html', './app.html', './panduan.html', './privasi.html',
  './config.js', './manifest.webmanifest',
  './css/tailwind.css', './css/style.css',
  './js/core.js', './js/views.js', './js/report.js', './js/admin.js', './js/pdf.js', './js/pwa.js',
  './vendor/lucide-0.460.0.min.js', './vendor/chart-4.4.6.umd.js', './vendor/sweetalert2-11.14.5.all.min.js',
  './vendor/jspdf-2.5.2.umd.min.js', './vendor/jspdf-autotable-3.8.4.min.js',
  './vendor/fonts/plus-jakarta-sans-latin-400-normal.woff2', './vendor/fonts/plus-jakarta-sans-latin-500-normal.woff2',
  './vendor/fonts/plus-jakarta-sans-latin-600-normal.woff2', './vendor/fonts/plus-jakarta-sans-latin-700-normal.woff2',
  './vendor/fonts/plus-jakarta-sans-latin-800-normal.woff2',
  './icons/icon-192.png', './icons/icon-512.png', './icons/favicon-32.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSI).then((c) => c.addAll(KULIT)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('edisiplin-') && k !== VERSI).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const STATIK = /\/(vendor|icons)\//;

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Apps Script, accounts.google.com, dll.

  if (STATIK.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSI).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  // Network-first (halaman, kod aplikasi, config.js)
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(VERSI).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() =>
      caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then((hit) =>
        hit || (req.mode === 'navigate' ? caches.match('./app.html') : Response.error())
      )
    )
  );
});
