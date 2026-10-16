/* ══════════════════════════════════════════════════════
   sw.js – Service Worker für das Studjo Terminal
   Version 31

   - lädt beim Installieren alle aktuell lokalen Terminal-Dateien vor
     (HTML, CSS, JS, JSON, Schriften, Bilder, PDF.js und Speiseplan-PDFs)
   - externe Angebote wie ConSense, LearningApps, VRR/Mobil.NRW und andere
     Fremdserver werden bewusst nicht gespeichert
   - ein neuer Worker wird nur aktiviert, wenn das vollständige lokale
     Offline-Paket erfolgreich aufgebaut wurde
   - HEAD-Anfragen der Speiseplan-Erkennung können offline auf bereits
     gespeicherte PDF-Dateien zurückgreifen
   - Runtime-Cache wird vor dem Precache bevorzugt, damit im Hintergrund
     aktualisierte Dateien beim nächsten Aufruf auch tatsächlich genutzt werden
   - Query-Parameter bei Network-first-Dateien werden beim Speichern
     normalisiert, damit z. B. ?v=<Zeitstempel> den Cache nicht aufbläht
   ══════════════════════════════════════════════════════ */

const CACHE_PREFIX  = 'studjo-terminal-';
const CACHE_VERSION = 'v31';
const PRECACHE = CACHE_PREFIX + CACHE_VERSION + '-precache';
const RUNTIME  = CACHE_PREFIX + CACHE_VERSION + '-runtime';

const OFFLINE_DATEIEN = [
  './',

  /* Root */
  "aba.html",
  "aba_adh.html",
  "aba_db.html",
  "aba_fbs.html",
  "aba_kh.html",
  "aba_ki.html",
  "aba_wd.html",
  "aba_whs.html",
  "abfahrt.html",
  "anzeige busse.html",
  "arbeitssicherheit.html",
  "bistropdf.html",
  "bistroplan.pdf",
  "datenschutz.html",
  "dingdong.mp3",
  "faq.html",
  "favicon.ico",
  "fluchtundrettungsplan.html",
  "impressum.html",
  "index.html",
  "infofilme.html",
  "learningapp-arbeitssicherheit.html",
  "learningapp-gewalt.html",
  "learningapp-wr.html",
  "losung.html",
  "manifest.webmanifest",
  "nachrichten-allgemein.html",
  "neuigkeiten.html",
  "offline.html",
  "opnv.html",
  "regeln.html",
  "speiseplan-ansicht.html",
  "speiseplan.html",
  "termine.html",
  "uebersicht.html",
  "verhaltenbeikonflikten.html",
  "werkstattordnung.html",
  "wetter.html",
  "wochenmotto.html",
  "wrfb.html",

  /* CSS */
  "css/a11y.css",
  "css/speiseplan-ansicht.css",
  "css/style-aba.css",
  "css/style-index.css",
  "css/style-news.css",
  "css/style.css",
  "css/wochenmotto.css",

  /* JavaScript */
  "js/a11y.js",
  "js/aba.js",
  "js/feiertage.js",
  "js/gong.js",
  "js/kacheln.js",
  "js/kalender.js",
  "js/offline.js",
  "js/script.js",
  "js/speiseplan-ansicht.js",
  "js/speiseplan-heute.js",
  "js/ticker.js",
  "js/ui-a11y.js",
  "js/wochenmotto.js",

  /* Daten */
  "data/aba.json",
  "data/kobinet.json",
  "data/losungen.json",
  "data/nachrichten.json",
  "data/neuigkeiten.json",
  "data/tagesschau.json",
  "data/tagesinfo.json",
  "data/speiseplan-kurz.json",
  "data/termine.json",
  "data/ticker.json",
  "data/wetter.json",
  "data/wochenmottos.json",

  /* Schriften */
  "fonts/nunito-sans-v19-latin-600.woff2",
  "fonts/nunito-sans-v19-latin-700.woff2",
  "fonts/nunito-sans-v19-latin-800.woff2",
  "fonts/nunito-sans-v19-latin-regular.woff2",

  /* Bilder */
  "img/aba.jpg",
  "img/aba_andacht.jpg",
  "img/aba_basteln.jpg",
  "img/aba_bewegung.jpg",
  "img/aba_bewegungtanz.jpg",
  "img/aba_buntefitnesskiste.jpg",
  "img/aba_chor.jpg",
  "img/aba_dart.jpg",
  "img/aba_diamontpainting.jpg",
  "img/aba_digitalemedien.jpg",
  "img/aba_disco.jpg",
  "img/aba_entspannung.jpg",
  "img/aba_erstehilfe.jpg",
  "img/aba_gesellschaftsspiele.jpg",
  "img/aba_gespraechskreis.jpg",
  "img/aba_kicker.jpg",
  "img/aba_lesenschreiben.jpg",
  "img/aba_mobil.jpg",
  "img/aba_modeschmuck.jpg",
  "img/aba_motorikballspiele.jpg",
  "img/aba_naturkreativ.jpg",
  "img/aba_sitztanz.jpg",
  "img/aba_snoezelen.jpg",
  "img/aba_spazieren.jpg",
  "img/aba_spielefarbenzahlen.jpg",
  "img/aba_spielspassbewegung.jpg",
  "img/aba_sportbewegung.jpg",
  "img/aba_tanzworkshop.jpg",
  "img/aba_tischtennis.jpg",
  "img/aba_tischtenniskicker.jpg",
  "img/aba_umwelt.jpg",
  "img/aba_vorlesen.jpg",
  "img/aba_walken.jpg",
  "img/aba_zirkus.jpg",
  "img/abfahrt.jpg",
  "img/antrag.jpg",
  "img/app.jpg",
  "img/apple-touch-icon.png",
  "img/arbeitssicherheit.jpg",
  "img/aussenpraktikum.jpg",
  "img/back.jpg",
  "img/berufsfelder.jpg",
  "img/bistro.jpg",
  "img/brandschutz.jpg",
  "img/bst-adh.jpg",
  "img/bst-aufderheide.jpg",
  "img/bst-dannenbaum.jpg",
  "img/bst-db.jpg",
  "img/bst-fbs.jpg",
  "img/bst-freisenberg.jpg",
  "img/bst-kerkhagen.jpg",
  "img/bst-kh.jpg",
  "img/bst-ki.jpg",
  "img/bst-kierspe.jpg",
  "img/bst-wd.jpg",
  "img/bst-wefelshohl.jpg",
  "img/bst-werdohl.jpg",
  "img/bst-whs.jpg",
  "img/bus.png",
  "img/essen.jpg",
  "img/ev_bbb.jpg",
  "img/faq-arbeit.jpg",
  "img/faq-beschwerde.jpg",
  "img/faq-blanko.jpg",
  "img/faq-entgelt.jpg",
  "img/faq-gewalt.jpg",
  "img/faq-krank.jpg",
  "img/faq-quali.jpg",
  "img/faq-sonstiges.jpg",
  "img/faq-urlaub.jpg",
  "img/faq-wr.jpg",
  "img/faq-zeiten.jpg",
  "img/faq.jpg",
  "img/feedback.jpg",
  "img/fem.jpg",
  "img/fem_konzept.jpg",
  "img/filme.jpg",
  "img/flucht.jpg",
  "img/flyer.jpg",
  "img/gewalt.jpg",
  "img/gewaltschutzkonzept.jpg",
  "img/header.jpg",
  "img/icon-192-v2.png",
  "img/icon-512-maskable-v2.png",
  "img/icon-1024-maskable-v2.png",
  "img/icon-512-v2.png",
  "img/icon-1024-v2.png",
  "img/information.jpg",
  "img/kompetenzen_im_bbb.jpg",
  "img/kontakt.jpg",
  "img/liebe.jpg",
  "img/lohn.jpg",
  "img/losung.jpg",
  "img/neues.jpg",
  "img/news-001allgemein.jpg",
  "img/news.jpg",
  "img/notfall.jpg",
  "img/opnv.jpg",
  "img/personal.jpg",
  "img/ppp_vorstellung_wr.jpg",
  "img/qr-terminal.jpg",
  "img/regeln.jpg",
  "img/schulung.jpg",
  "img/screenshot-neuigkeiten.png",
  "img/screenshot-startseite.png",
  "img/screenshot-wochenmotto.png",
  "img/soziale_akt.jpg",
  "img/speiseplan_diese_woche.jpg",
  "img/speiseplan_kommende_kommende_woche.jpg",
  "img/speiseplan_kommende_woche.jpg",
  "img/start.png",
  "img/studjo_logo_kfz.png",
  "img/termine.jpg",
  "img/text.jpg",
  "img/video.jpg",
  "img/werkstatt.jpg",
  "img/werkstattrat.jpg",
  "img/wetter.jpg",
  "img/wochenmotto.jpg",
  "img/ziel.png",
  "img/zuhoeren.jpg",
  "img/zusammenarbeit.jpg",

  /* PDF.js */
  "pdfjs/pdf.min.mjs",
  "pdfjs/pdf.worker.min.mjs",

  /* Speisepläne */
  "speiseplaene/speiseplan_2026-KW42.pdf",
  "speiseplaene/speiseplan_2026-KW43.pdf",
  "speiseplaene/speiseplan_2026-KW44.pdf",
  "speiseplaene/speiseplan_2026-KW45.pdf",
  "speiseplaene/speiseplan_2026-KW46.pdf",
];

function absolut(pfad) {
  return new URL(pfad, self.registration.scope).href;
}

const PRELOAD_PARALLEL = 8;

async function offlineDateienLaden() {
  const cache = await caches.open(PRECACHE);
  const fehler = [];
  let naechsterIndex = 0;

  async function arbeiter() {
    while (true) {
      const index = naechsterIndex++;
      if (index >= OFFLINE_DATEIEN.length) return;

      const pfad = OFFLINE_DATEIEN[index];

      try {
        const url = absolut(pfad);
        const antwort = await fetch(url, { cache: 'reload' });

        if (!antwort.ok) {
          throw new Error('HTTP ' + antwort.status);
        }

        await cache.put(url, antwort.clone());

      } catch (fehlerObjekt) {
        fehler.push({ pfad, fehler: fehlerObjekt });
        console.warn(
          '[Studjo SW] Offline-Datei nicht geladen:',
          pfad,
          fehlerObjekt
        );
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(PRELOAD_PARALLEL, OFFLINE_DATEIEN.length) },
      () => arbeiter()
    )
  );

  if (fehler.length) {
    /* Ein unvollständiger neuer Precache soll den funktionierenden alten
       Service Worker nicht ablösen. Beim nächsten Online-Aufruf versucht
       der Browser die Installation erneut. */
    await caches.delete(PRECACHE);
    throw new Error(
      'Offline-Paket unvollständig: ' + fehler.length + ' Datei(en) fehlen.'
    );
  }

  console.info(
    '[Studjo SW] Offline-Paket vollständig:',
    OFFLINE_DATEIEN.length,
    'Dateien/URLs'
  );
}

self.addEventListener('install', event => {
  event.waitUntil(
    offlineDateienLaden()
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
  /* Runtime zuerst: Dort liegen frisch im Hintergrund aktualisierte Dateien.
     Der Precache bleibt die verlässliche Offline-Grundlage. */
  const runtime = await caches.open(RUNTIME);
  const runtimeTreffer = await runtime.match(request, { ignoreSearch });
  if (runtimeTreffer) return runtimeTreffer;

  const precache = await caches.open(PRECACHE);
  return precache.match(request, { ignoreSearch });
}

function cacheSchluessel(request, ignoreSearch = false) {
  if (!ignoreSearch) return request;

  const url = new URL(request.url);
  url.search = '';
  url.hash = '';

  return new Request(url.href, { method: 'GET' });
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
      await cache.put(
        cacheSchluessel(request, ignoreSearch),
        antwort.clone()
      );
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

/* Die wichtigsten Startseiten-Dateien werden bewusst network-first
   geladen. Damit sieht die installierte Android-PWA Änderungen an der
   Tageskarte künftig beim normalen Öffnen und nicht erst nach einem
   manuellen Finger-Reload. Offline bleibt der Cache der Fallback. */
function istStartseitenKernDatei(url) {
  const scope = new URL(self.registration.scope);
  const basis = scope.pathname;

  return [
    basis + 'js/kacheln.js',
    basis + 'js/gong.js',
    basis + 'js/offline.js',
    basis + 'css/style-index.css'
  ].includes(url.pathname);
}


async function headNetzwerkOderCache(request) {
  try {
    const online = await fetch(request);

    /* Ein echter HTTP-Fehler (z. B. 404) soll online nicht durch eine
       eventuell ältere Cache-Datei verdeckt werden. */
    if (online) return online;

  } catch (fehler) {
    /* Offline: im Cache nach der zugehörigen GET-Datei suchen. */
  }

  const cacheTreffer = await caches.match(
    request,
    {
      ignoreSearch: true,
      ignoreMethod: true
    }
  );

  if (cacheTreffer) {
    return new Response(
      null,
      {
        status: cacheTreffer.status || 200,
        statusText: cacheTreffer.statusText || 'OK',
        headers: cacheTreffer.headers
      }
    );
  }

  return new Response(null, { status: 404, statusText: 'Offline – nicht gespeichert' });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  /* Externe Server bewusst nicht verändern/cachen. */
  if (url.origin !== self.location.origin) return;

  /* Speiseplan-Skripte prüfen PDF-Dateien per HEAD. Offline kann dieser
     Test nun auf den bereits gespeicherten GET-Eintrag zurückgreifen. */
  if (request.method === 'HEAD') {
    event.respondWith(
      headNetzwerkOderCache(request)
    );
    return;
  }

  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    if (istStartseitenNavigation(url)) {
      event.respondWith(
        netzwerkZuerst(request, 2500, true, true)
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

  if (istStartseitenKernDatei(url)) {
    event.respondWith(
      netzwerkZuerst(request, 3500, true, false)
    );
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
