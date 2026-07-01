/* ============================================
   SmartRoom / SATOM — service-worker.js
   Cachea los archivos estáticos (CSS, JS, íconos)
   para que la app cargue rápido. Los datos de la
   API (/api/...) NUNCA se cachean: siempre se piden
   en vivo para que la ocupación se vea actualizada.
   ============================================ */

const CACHE_NAME = "smartroom-cache-v2";

const ARCHIVOS_ESTATICOS = [
  "/static/css/style.css",
  "/static/js/app.js",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png",
  "/static/manifest.json",
];

// Instala el service worker y cachea los archivos estáticos
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARCHIVOS_ESTATICOS))
  );
  self.skipWaiting();
});

// Limpia versiones viejas de caché
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Estrategia de carga:
//  - Para /api/...      -> siempre red (datos en tiempo real, nunca caché)
//  - Para todo lo demás -> caché primero, red como respaldo
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          // Guarda en caché las páginas visitadas para la próxima vez
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
      );
    })
  );
});

