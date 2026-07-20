// Service worker mínimo: hace la app instalable y carga rápido la pantalla.
// NO cachea las respuestas de audio ni las llamadas a /api (siempre en vivo).
// La PÁGINA se pide siempre en vivo primero (network-first) para que los
// despliegues nuevos se vean de inmediato; la caché es solo respaldo offline.
const CACHE = "voz-texto-v7";
const SHELL = ["/", "/index.html", "/icono.svg", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.pathname.startsWith("/api/")) return; // API siempre en vivo

  const esPagina = e.request.mode === "navigate" || url.pathname === "/" || url.pathname === "/index.html";
  if (esPagina) {
    // Red primero: así siempre llega la última versión desplegada.
    e.respondWith(
      fetch(e.request).then((r) => {
        if (r.ok && url.origin === location.origin) {
          const copia = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copia));
        }
        return r;
      }).catch(() => caches.match(e.request).then((hit) => hit || caches.match("/index.html"))),
    );
    return;
  }

  // Estáticos (icono, manifest…): caché primero, como antes.
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
      if (r.ok && url.origin === location.origin) {
        const copia = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia));
      }
      return r;
    }).catch(() => hit)),
  );
});
