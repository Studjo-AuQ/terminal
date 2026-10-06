/* ══════════════════════════════════════════════════════
   sw.js – Service Worker für das Studjo Terminal
   Version 3

   Ziele:
   - robuste Installation auch dann, wenn EINE Core-Datei fehlt
   - schnelle, bereits gespeicherte Unterseiten
   - Netzwerk-Aktualisierung im Hintergrund
   - verlässliche offline.html als Rückfall
   - KEINE Löschung fremder Caches (z. B. anderes GitHub-Repo Checkpoint)
   ══════════════════════════════════════════════════════ */

const CACHE_PREFIX  = 'studjo-terminal-';
const CACHE_VERSION = 'v3';
const PRECACHE = CACHE_PREFIX + CACHE_VERSION + '-precache';
const RUNTIME  = CACHE_PREFIX + CACHE_VERSION + '-runtime';

const CORE_DATEIEN = [
  './',
  'index.html',
  'offline.html',
  'manifest.webmanifest',

  'style.css',
  'style-index.css',
  'a11y.css',

  'gong.js',
  'offline.js',
  'a11y.js',
  'feiertage.js',
  'kalender.js',
  'kacheln.js',

  'favicon.ico',
  'header.jpg',
  'dingdong.mp3',
  'qr-terminal.jpg',

  'icon-192.png',
  'icon-512.png',
  'icon-512-maskable.png',
  'apple-touch-icon.png',

  /* Lokale dynamische Daten, die wichtige Startseiten-Unterseiten nutzen. */
  'wetter.json',
  'wochenmottos.json',
  'data/losungen.json',
  'tagesschau.json',
  'kobinet.json',
  'nachrichten.json',
];

function absolut(pfad) {
  return new URL(pfad, self.registration.scope).href;
}

async function coreDateienLaden() {
  const cache = await caches.open(PRECACHE);

  /* Bewusst NICHT cache.addAll():
     Eine einzige 404-Datei darf die komplette SW-Installation nicht
     mehr verhindern. Jede Datei wird unabhängig versucht. */
  await Promise.allSettled(
    CORE_DATEIEN.map(async pfad => {
      try {
        const url = absolut(pfad);
        const antwort = await fetch(url, { cache: 'reload' });

        if (!antwort.ok) {
          console.warn('[Studjo SW] Core-Datei nicht geladen:', pfad, antwort.status);
          return;
        }

        await cache.put(url, antwort.clone());
      } catch (fehler) {
        console.warn('[Studjo SW] Core-Datei nicht erreichbar:', pfad, fehler);
      }
    })
  );
}

self.addEventListener('install', event => {
  event.waitUntil(
    coreDateienLaden()
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(namen => Promise.all(
        namen
          /* Wichtig: Nur eigene Studjo-Terminal-Caches löschen.
             Andere Apps unter studjo-auq.github.io bleiben unangetastet. */
          .filter(name =>
            name.startsWith(CACHE_PREFIX) &&
            name !== PRECACHE &&
            name !== RUNTIME
          )
          .map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

function minimaleOfflineAntwort() {
  return new Response(
    '<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1.0">' +
    '<title>Kein Internet – Studjo Terminal</title></head>' +
    '<body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;' +
    'text-align:center;padding:60px 20px;color:#0f2f37">' +
    '<div style="font-size:3rem">📶</div>' +
    '<h1 style="color:#b61f29;font-size:1.6rem">Kein Internet gerade</h1>' +
    '<p style="font-size:1.1rem">Diese Seite ist gerade nicht gespeichert.<br>' +
    'Bitte versuche es später noch einmal.</p>' +
    '<button onclick="location.reload()" style="font-size:1.1rem;font-weight:800;' +
    'color:#fff;background:#b61f29;border:0;border-radius:999px;' +
    'padding:14px 32px">Noch einmal versuchen</button>' +
    '</body></html>',
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  );
}

async function ausCache(request, ignoreSearch = false) {
  return caches.match(request, { ignoreSearch });
}

async function offlineFallback() {
  const offline = await caches.match(absolut('offline.html'), { ignoreSearch: true });
  return offline || minimaleOfflineAntwort();
}

async function fetchUndSpeichern(request) {
  const antwort = await fetch(request);

  if (antwort && antwort.ok) {
    const cache = await caches.open(RUNTIME);
    await cache.put(request, antwort.clone());
  }

  return antwort;
}

/* Aktuelle Version bevorzugen; bei langsamem/fehlendem Netz Cache nutzen. */
async function netzwerkZuerst(request, timeoutMs, ignoreSearch = false, htmlFallback = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const antwort = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);

    if (antwort && antwort.ok) {
      const cache = await caches.open(RUNTIME);
      await cache.put(request, antwort.clone());
      return antwort;
    }

    const cacheTreffer = await ausCache(request, ignoreSearch);
    if (cacheTreffer) return cacheTreffer;

    /* Eine echte HTTP-Antwort (z. B. 404) bleibt eine echte
       HTTP-Antwort. offline.html ist nur für fehlendes Netz gedacht. */
    return antwort;
  } catch (fehler) {
    clearTimeout(timer);

    const cacheTreffer = await ausCache(request, ignoreSearch);
    if (cacheTreffer) return cacheTreffer;

    if (htmlFallback) return offlineFallback();
    return Response.error();
  }
}

/* Unterseiten: Cache sofort anzeigen, parallel online aktualisieren.
   Genau dadurch profitieren die zuvor im Hintergrund geladenen Seiten
   beim Anklicken von einem sehr schnellen Start. */
async function navigationCacheZuerst(request, event) {
  const cacheTreffer = await ausCache(request, true);

  const update = fetchUndSpeichern(request).catch(() => null);

  if (cacheTreffer) {
    event.waitUntil(update);
    return cacheTreffer;
  }

  const online = await update;
  if (online) return online;

  return offlineFallback();
}

/* CSS, JS, Bilder, Schriften, Ton: Cache zuerst, online erneuern. */
async function dateiCacheZuerst(request, event) {
  const cacheTreffer = await ausCache(request, false);
  const update = fetchUndSpeichern(request).catch(() => null);

  if (cacheTreffer) {
    event.waitUntil(update);
    return cacheTreffer;
  }

  const online = await update;
  return online || Response.error();
}

function istStartseitenNavigation(url) {
  const scope = new URL(self.registration.scope);
  return url.pathname === scope.pathname ||
         url.pathname === scope.pathname + 'index.html';
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  /* Externe Server bewusst nicht verändern/cachen. */
  if (url.origin !== self.location.origin) return;

  /* 1) Echte Browser-Navigation */
  if (request.mode === 'navigate') {
    if (istStartseitenNavigation(url)) {
      /* Startseite möglichst aktuell halten. */
      event.respondWith(netzwerkZuerst(request, 1500, true, true));
    } else {
      /* Unterseiten aus dem vorgeladenen Cache sofort öffnen. */
      event.respondWith(navigationCacheZuerst(request, event));
    }
    return;
  }

  /* 2) HTML-Dateien, die offline.js im Hintergrund abruft:
        Netzwerk zuerst, damit der Cache wirklich aktualisiert wird. */
  if (/\.html$/i.test(url.pathname)) {
    event.respondWith(netzwerkZuerst(request, 4000, true, true));
    return;
  }

  /* 3) Daten/PDFs: Aktualität wichtiger als Geschwindigkeit.
        ignoreSearch=true ist wichtig für wetter.json?v=... usw. */
  if (/\.(json|pdf)$/i.test(url.pathname)) {
    event.respondWith(netzwerkZuerst(request, 5000, true, false));
    return;
  }

  /* 4) Statische Dateien */
  event.respondWith(dateiCacheZuerst(request, event));
});
