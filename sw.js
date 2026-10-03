/* ══════════════════════════════════════════════════════
   sw.js – Service Worker für das Studjo Terminal
   Macht die Seite installierbar (PWA) und offline-fähig.

   WICHTIG FÜR MARC: Diese Datei muss NICHT für jede neue
   Unterseite angepasst werden – das ist bewusst so gebaut:
     - Nur eine kurze, stabile Liste zentraler Dateien wird beim
       ersten Besuch fest vorab geladen (CORE_DATEIEN unten).
     - Alle anderen Seiten (aba.html, wetter.html, speiseplan.html,
       usw.) werden automatisch zwischengespeichert, sobald sie
       einmal besucht wurden – ganz ohne dass diese Liste hier
       gepflegt werden muss. Neue Unterseiten funktionieren sofort
       mit, ohne dass sw.js angefasst werden muss.
     - CACHE_VERSION unten nur erhöhen, wenn wirklich mal ALLE
       Geräte zu einem kompletten Neustart des Caches gezwungen
       werden sollen (z. B. nach einem großen Umbau). Für normale
       Aktualisierungen (neue index.html, neues gong.js, usw.) ist
       das NICHT nötig – die Strategie unten holt Neuerungen
       automatisch, sobald ein Gerät online ist.
   ══════════════════════════════════════════════════════ */

const CACHE_VERSION = 'studjo-terminal-v1';
const PRECACHE = CACHE_VERSION + '-precache';
const RUNTIME  = CACHE_VERSION + '-runtime';

/* Kleine, stabile Liste: Startseite + alles, was praktisch jede
   Seite braucht (Stylesheets, Gong, Barrierefreiheit, Icons,
   Offline-Seite). Bewusst KEINE Liste aller 36 Unterseiten. */
const CORE_DATEIEN = [
  './',
  'index.html',
  'offline.html',
  'manifest.webmanifest',
  'style.css',
  'style-index.css',
  'gong.js',
  'feiertage.js',
  'kalender.js',
  'a11y.js',
  'a11y.css',
  'favicon.ico',
  'header.jpg',
  'dingdong.mp3',
  'qr-terminal.jpg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-512-maskable.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE)
      .then((cache) => cache.addAll(CORE_DATEIEN))
      // Neue Version sofort aktiv werden lassen, nicht erst wenn
      // alle offenen Tabs geschlossen wurden – wichtig, damit
      // Updates auf dem Kiosk-Terminal zügig ankommen.
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(
        namen
          .filter((name) => name !== PRECACHE && name !== RUNTIME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

/* Netzwerk zuerst, mit Timeout – für Inhalte, bei denen Aktualität
   wichtiger ist als Geschwindigkeit (Seitenaufrufe, Daten-Dateien).
   Fällt bei Zeitüberschreitung oder Offline auf die zuletzt
   gespeicherte Version zurück, als letzte Rettung auf offline.html. */
function netzwerkZuerst(request, timeoutMs) {
  return new Promise((resolve) => {
    let entschieden = false;
    const aufCacheAusweichen = () => {
      caches.match(request).then((treffer) => {
        if (entschieden) return;
        entschieden = true;
        resolve(treffer || caches.match('offline.html'));
      });
    };
    const timer = setTimeout(aufCacheAusweichen, timeoutMs);

    fetch(request).then((antwort) => {
      clearTimeout(timer);
      if (entschieden) return;
      entschieden = true;
      if (antwort && antwort.ok) {
        const kopie = antwort.clone();
        caches.open(RUNTIME).then((cache) => cache.put(request, kopie));
      }
      resolve(antwort);
    }).catch(() => {
      clearTimeout(timer);
      aufCacheAusweichen();
    });
  });
}

/* Cache zuerst (schnell), parallel im Hintergrund aktualisieren –
   für Dateien, bei denen Geschwindigkeit zählt und ein kurzzeitig
   veralteter Stand unkritisch ist (CSS, Bilder, Schriften, usw.). */
function cacheZuerstMitUpdate(request) {
  return caches.match(request).then((treffer) => {
    const netzwerk = fetch(request).then((antwort) => {
      if (antwort && antwort.ok) {
        const kopie = antwort.clone();
        caches.open(RUNTIME).then((cache) => cache.put(request, kopie));
      }
      return antwort;
    }).catch(() => treffer);
    return treffer || netzwerk;
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // fremde Server unangetastet lassen

  // Seitenaufrufe (Navigation zwischen den HTML-Seiten)
  if (request.mode === 'navigate') {
    event.respondWith(netzwerkZuerst(request, 3000));
    return;
  }

  // Daten-Dateien, bei denen Aktualität besonders wichtig ist
  // (Speiseplan-PDFs, evtl. künftige JSON-Datenquellen)
  if (/\.(pdf|json)$/i.test(url.pathname)) {
    event.respondWith(netzwerkZuerst(request, 4000));
    return;
  }

  // Alles andere (CSS, JS, Bilder, Schriften, Ton): schnell aus dem
  // Cache, im Hintergrund aktualisiert
  event.respondWith(cacheZuerstMitUpdate(request));
});
