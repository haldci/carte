/*!
 * sw.js — Service worker : rend la carte utilisable sans réseau. Licence : MIT.
 * Stratégie « stale-while-revalidate » : réponse immédiate depuis le cache,
 * mise à jour silencieuse en arrière-plan (visible à l'ouverture suivante).
 * Les liens externes (LinkedIn, Drive…) ne sont jamais interceptés.
 */
var CACHE = "carte-v4";
// CV mis en cache à l'installation, pour les montrer sans réseau sur votre téléphone.
// Facultatifs : un fichier absent ne bloque pas l'installation. Gardez ces noms si vous remplacez un CV.
var OPTIONAL = [
  "./CV_Halim_ALLAOUI_FR.pdf",
  "./CV_Halim_ALLAOUI_EN.pdf"
];
var ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./qrcode.js",
  "./vcard.js",
  "./config.js",
  "./photo.jpg",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) {
        return cache.addAll(ASSETS).then(function () {
          return Promise.all(OPTIONAL.map(function (u) { return cache.add(u).catch(function () { return null; }); }));
        });
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Clé de cache sans paramètres (?mode=salon&qr=… pointe vers la même page)
  var key = url.origin + url.pathname;

  var network = fetch(req.url, { cache: "no-cache", credentials: "same-origin" })
    .then(function (res) {
      if (!res || !res.ok) return res;
      // Une réponse redirigée ne peut pas servir une navigation : on la reconstruit
      if (res.redirected) {
        res = new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers });
      }
      var copy = res.clone();
      return caches.open(CACHE)
        .then(function (cache) { return cache.put(key, copy); })
        .then(function () { return res; });
    })
    .catch(function () { return null; });

  event.waitUntil(network.then(function () { return undefined; }));

  event.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(key).then(function (cached) {
        if (cached) return cached;
        return network.then(function (res) {
          if (res) return res;
          if (req.mode === "navigate") {
            return cache.match(new URL("./", self.registration.scope).href).then(function (shell) {
              return shell || new Response("Hors ligne", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
            });
          }
          return new Response("", { status: 504 });
        });
      });
    })
  );
});
