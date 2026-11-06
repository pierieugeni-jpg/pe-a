// Service worker mínimo para que la app sea instalable. Sin modo offline en el MVP:
// todo va a la red.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
