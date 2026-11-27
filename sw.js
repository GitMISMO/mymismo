/* MyMISMO offline support.
   The app's own files are kept on the phone so it opens without a connection.
   The agenda and sponsor feeds are fetched fresh whenever there is a connection,
   and the last copy is used when there isn't. Pictures (headshots, logos) are kept once seen. */
var VERSION = 'mymismo-2026-11-30k';
var SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', '/assets/back.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('mymismo-') === 0 && k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
function fresh(req) {
  /* ask the server every time (the browser's own copy can be up to 10 minutes old), so a new version shows at once */
  var ask = req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req, { cache: 'no-cache' });
  return ask.then(function (res) {
    if (res && (res.ok || res.type === 'opaque')) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
    return res;
  });
}
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var feed = url.origin === location.origin && (/\.json$/.test(url.pathname) || url.pathname.indexOf('/assets/') === 0);   /* feeds, and the shared sign-in file */
  var page = req.mode === 'navigate';
  /* the save relay (sign-in, messages, alerts, slides) and anything else from elsewhere that isn't a picture or font
     always goes to the network: never a kept copy */
  if (url.origin !== location.origin && ['image', 'font', 'style'].indexOf(req.destination) < 0) return;
  if (feed || page) {
    /* network first, last copy when offline */
    e.respondWith(fresh(req).catch(function () { return caches.match(req, { ignoreSearch: page }).then(function (r) { return r || caches.match('index.html'); }); }));
    return;
  }
  /* everything else: the kept copy, refreshed in the background */
  e.respondWith(caches.match(req).then(function (hit) {
    var net = fresh(req).catch(function () { return hit; });
    return hit || net;
  }));
});

/* Alerts (relay request 14): show the alert, and open MyMISMO where it points when it's tapped */
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'MyMISMO', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'MyMISMO', {
    body: d.body || '', tag: d.id || 'mymismo', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
    data: { url: d.url || '/mymismo/?page=home' }
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/mymismo/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) if (list[i].url.indexOf('/mymismo/') >= 0 && 'focus' in list[i]) { list[i].postMessage({ alertUrl: url }); return list[i].focus(); }
    return self.clients.openWindow(url);
  }));
});
