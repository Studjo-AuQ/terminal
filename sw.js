/* ══════════════════════════════════════════════════════
   sw.js – Service Worker für das Studjo Terminal
   Version 26

   Neu in Version 26:
   - CSS- und JavaScript-Dateien werden schrittweise in die Ordner css/ und
     js/ verschoben.
   - Während der Übergangsphase werden die bisherigen Root-Pfade UND die
     neuen Ordnerpfade parallel vorgeladen.
   - Dadurch funktionieren bereits geöffnete/zwischengespeicherte Seiten
     weiterhin, während die HTML-Dateien anschließend auf css/ und js/
     umgestellt werden.
   - sw.js bleibt bewusst im Root, damit der Service-Worker-Scope unverändert
     das komplette Terminal unter /terminal/ umfasst.
   - Versionssprung leert die alten v25-Caches und baut den Übergangscache
     mit alten und neuen Asset-Pfaden neu auf.

   Weiter aus Version 25:
   - Bilddateien mit Großbuchstaben und/oder Leerzeichen wurden im Ordner
     img/ auf einheitliche kleingeschriebene Dateinamen umgestellt.
   - Leerzeichen in Bilddateinamen wurden durch Unterstriche ersetzt.
   - Versionssprung leert alte v24-Runtime-Caches, damit keine alten
     Bildpfade aus dem Browser-Cache weiterverwendet werden.

   Weiter aus Version 24:
   - lokale JPG- und PNG-Dateien liegen gesammelt im Ordner img/.
   - alle vorgeladenen Bilder und PWA-Icons verwenden die neuen img/-Pfade.
   - der veraltete apple-touch-icon-Verweis wurde entfernt.
   - Versionssprung leert alte v23-Caches mit Bildpfaden aus dem Root.

   Weiter aus Version 23:
   - alle dynamischen JSON-Daten liegen gesammelt unter data/.
   - während der manuellen Migration dürfen die alten Root-JSON-Dateien
     vorübergehend noch bestehen; die Seiten verwenden data/ als Hauptpfad.
   - Wetter- und RSS-Actions schreiben direkt nach data/.
   - Versionssprung leert alte v22-Caches für die Datenordner-Migration.

   Weiter aus Version 22:
   - alle sieben AbA-Standortseiten verwenden die zentrale data/aba.json
     und das gemeinsame aba.js.
   - die neuen Unterseiten heißen aba_fbs.html, aba_adh.html, aba_wd.html,
     aba_ki.html, aba_whs.html, aba_kh.html und aba_db.html.
   - data/aba.json, aba.js, style-aba.css, aba.html und die sieben Standort-
     hüllen werden für den Offline-Betrieb vorgeladen.
   - Versionssprung leert alte v21-Caches für die AbA-Migration.

   Weiter aus Version 21:
   - neuigkeiten.html ist eine feste Darstellungsseite und lädt
     ihre Inhalte ausschließlich aus data/neuigkeiten.json.
   - data/neuigkeiten.json wird offline vorgeladen.

   Weiter aus Version 20:
   - speiseplan-heute.js erkennt auf PDF-Seite 2 auch helle und farbige
     Tabellenlinien zuverlässig.
   - ein proportionaler Raster-Fallback sichert die drei Essensbilder
     zusätzlich gegen kleinere Designänderungen der PDF ab.

   Weiter aus Version 19:
   - manifest.webmanifest enthält zusätzliche PWA-Metadaten,
     Smartphone-Screenshots und App-Shortcuts.
   - die drei PWA-Screenshots werden für Offline-Nutzung mit vorgeladen.

   Weiter aus Version 18:
   - ticker.js macht auch die visuelle Endlos-Kopie der Meldungen
     zuverlässig anklickbar.
   - Stop/Play nutzt eine zentrale Pause-/Play-Steuerung und zusätzlich
     die Web Animations API als Chrome-/Android-Absicherung.
   - Touch-Geräte können nicht mehr durch einen festhängenden CSS-Hover
     im Pause-Zustand bleiben.

   Weiter aus Version 17:
   - Gong wird auf der Startseite nur noch durch direkten Klick auf
     die Glocke aktiviert oder deaktiviert.
   - Freie Klicks auf die Startseite verändern den Gong-Status nicht.
   - Gong und Kalender zeigen passende Mouseover-Hinweise.

   Weiter aus Version 16:
   - opnv.html nutzt direkte Startseiten-Zurücklinks und umgeht damit
     störende iframe-/Browser-History zuverlässig.
   - index.html enthält den Gong-Aktivierungshinweis.

   Weiter aus Version 15:
   - direkte Bereichs-Zurücklinks können iframe-History gezielt umgehen.
   - ticker.js startet bei freiem Startseiten-Klick und bei Rückkehr
     auf die Startseite zuverlässig wieder.
   - neuigkeiten.html bleibt netzwerk-zuerst.
   ══════════════════════════════════════════════════════ */

const CACHE_PREFIX  = 'studjo-terminal-';
const CACHE_VERSION = 'v26';
const PRECACHE = CACHE_PREFIX + CACHE_VERSION + '-precache';
const RUNTIME  = CACHE_PREFIX + CACHE_VERSION + '-runtime';

const CORE_DATEIEN = [
  './',
  'index.html',
  'neuigkeiten.html',
  'aba.html',
  'aba_fbs.html',
  'aba_adh.html',
  'aba_wd.html',
  'aba_ki.html',
  'aba_whs.html',
  'aba_kh.html',
  'aba_db.html',
  'offline.html',
  'manifest.webmanifest',

  /* Übergangsphase CSS:
     Die Root-Dateien bleiben bis zum Abschluss der Migration bestehen.
     Parallel werden bereits die neuen Dateien unter css/ vorgeladen. */
  'style.css',
  'style-index.css',
  'style-news.css',
  'style-aba.css',
  'a11y.css',
  'css/style.css',
  'css/style-index.css',
  'css/style-news.css',
  'css/style-aba.css',
  'css/a11y.css',

  /* Übergangsphase JavaScript:
     Alte Root-Pfade und neue js/-Pfade werden parallel vorgeladen. */
  'gong.js',
  'offline.js',
  'a11y.js',
  'ui-a11y.js',
  'ticker.js',
  'feiertage.js',
  'kalender.js',
  'kacheln.js',
  'speiseplan-heute.js',
  'aba.js',
  'js/gong.js',
  'js/offline.js',
  'js/a11y.js',
  'js/ui-a11y.js',
  'js/ticker.js',
  'js/feiertage.js',
  'js/kalender.js',
  'js/kacheln.js',
  'js/speiseplan-heute.js',
  'js/aba.js',

  'favicon.ico',
  'img/header.jpg',
  'dingdong.mp3',
  'img/qr-terminal.jpg',

  /* PWA-Installationsvorschau */
  'img/screenshot-startseite.png',
  'img/screenshot-neuigkeiten.png',
  'img/screenshot-wochenmotto.png',

  'img/icon-192.png',
  'img/icon-512.png',
  'img/icon-512-maskable.png',
  /* Lokale dynamische Daten */
  'data/neuigkeiten.json',
  'data/aba.json',
  'data/termine.json',
  'data/ticker.json',
  'data/wetter.json',
  'data/wochenmottos.json',
  'data/losungen.json',
  'data/tagesschau.json',
  'data/kobinet.json',
  'data/nachrichten.json'
];

function absolut(pfad) {
  return new URL(pfad, self.registration.scope).href;
}

async function coreDateienLaden() {
  const cache = await caches.open(PRECACHE);

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
    'Bitte versuche es später noch einmal.<br><br>' +
    'ConSense und LearningApps brauchen Internet.</p>' +
    '<button onclick="location.reload()" style="font-size:1.1rem;font-weight:800;' +
    'color:#fff;background:#b61f29;border:0;border-radius:999px;' +
    'padding:14px 32px">Noch einmal versuchen</button>' +
    '</body></html>',
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    }
  );
}

async function ausCache(request, ignoreSearch = false) {
  return caches.match(request, { ignoreSearch });
}

async function offlineFallback() {
  const offline = await caches.match(
    absolut('offline.html'),
    { ignoreSearch: true }
  );

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

async function netzwerkZuerst(
  request,
  timeoutMs,
  ignoreSearch = false,
  htmlFallback = false
) {
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

    return antwort;

  } catch (fehler) {
    clearTimeout(timer);

    const cacheTreffer = await ausCache(request, ignoreSearch);
    if (cacheTreffer) return cacheTreffer;

    if (htmlFallback) return offlineFallback();
    return Response.error();
  }
}

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

function istNeuigkeitenNavigation(url) {
  const scope = new URL(self.registration.scope);

  return url.pathname ===
    scope.pathname + 'neuigkeiten.html';
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  /* Externe Server bewusst nicht verändern/cachen. */
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    if (istStartseitenNavigation(url)) {
      event.respondWith(
        netzwerkZuerst(request, 1500, true, true)
      );

    } else if (istNeuigkeitenNavigation(url)) {
      /* Neuigkeiten werden häufig über die Pflege-App aktualisiert.
         Deshalb online immer zuerst die aktuelle Server-Version laden.
         Der Cache bleibt ausschließlich als Offline-/Fehler-Fallback. */
      event.respondWith(
        netzwerkZuerst(request, 4000, true, true)
      );

    } else {
      event.respondWith(
        navigationCacheZuerst(request, event)
      );
    }
    return;
  }

  if (/\.html$/i.test(url.pathname)) {
    event.respondWith(
      netzwerkZuerst(request, 4000, true, true)
    );
    return;
  }

  if (/\.(json|pdf)$/i.test(url.pathname)) {
    event.respondWith(
      netzwerkZuerst(request, 5000, true, false)
    );
    return;
  }

  event.respondWith(
    dateiCacheZuerst(request, event)
  );
});
