/* ══════════════════════════════════════════════════════
   offline.js – PWA / Offline / Hintergrund-Vorladen
   Studjo Terminal

   Aufgaben:
   - sw.js registrieren und aktuell halten
   - bereits geöffnete Seite nach Aktivierung im Cache sichern
   - von index.html aus interne HTML-Seiten automatisch entdecken
   - zugehörige lokale Bilder, CSS-, JS-, Schrift- und Mediendateien
     ebenfalls im Hintergrund laden
   - Zeitstempel ERST nach einem weitgehend erfolgreichen Lauf setzen

   Externe Server (ConSense, VRR, mobil.nrw usw.) werden bewusst NICHT
   vorgeladen oder gespeichert.
   ══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) {
    console.info('[Studjo] Dieser Browser unterstützt keine Service Worker.');
    return;
  }

  const VORLADEN_SCHLUESSEL = 'studjo-offline-v3-vorladen-erfolgreich';
  const ALTER_SCHLUESSEL     = 'studjo-vorladen-zeitpunkt';
  const VORLADEN_ABSTAND_MS  = 24 * 60 * 60 * 1000;

  const MAX_SEITEN      = 80;
  const MAX_RESSOURCEN  = 450;
  const RESSOURCEN_PARALLEL = 6;

  let vorladenLaeuft = false;

  /* Alte, fehlerhafte Claude-Sperre einmal beseitigen. */
  try {
    localStorage.removeItem(ALTER_SCHLUESSEL);
  } catch (e) {
    /* localStorage kann in sehr restriktiven Browser-Modi blockiert sein. */
  }

  /* Einige ältere HTML-Seiten verweisen noch auf /icons/...,
     obwohl die Dateien im Repo-Hauptverzeichnis liegen.
     Für die laufende Seite korrigieren wir wenigstens das Apple-Icon
     dynamisch. manifest.webmanifest wird zusätzlich dauerhaft korrigiert. */
  const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
  if (appleIcon && /(^|\/)icons\/apple-touch-icon\.png(?:$|[?#])/i.test(appleIcon.getAttribute('href') || '')) {
    appleIcon.setAttribute('href', 'apple-touch-icon.png');
  }

  function istStartseite() {
    const dateiname = location.pathname.split('/').pop();
    return dateiname === '' || dateiname === 'index.html';
  }

  function schonVorKurzemGeladen() {
    try {
      const wert = parseInt(localStorage.getItem(VORLADEN_SCHLUESSEL), 10);
      return Number.isFinite(wert) && (Date.now() - wert) < VORLADEN_ABSTAND_MS;
    } catch (e) {
      return false;
    }
  }

  function erfolgMerken() {
    try {
      localStorage.setItem(VORLADEN_SCHLUESSEL, String(Date.now()));
    } catch (e) {
      /* Ohne localStorage wird beim nächsten Besuch erneut vorgeladen. */
    }
  }

  function warteAufController(timeoutMs = 12000) {
    if (navigator.serviceWorker.controller) {
      return Promise.resolve(true);
    }

    return new Promise(resolve => {
      let fertig = false;

      const beenden = (wert) => {
        if (fertig) return;
        fertig = true;
        navigator.serviceWorker.removeEventListener('controllerchange', gewechselt);
        resolve(wert);
      };

      const gewechselt = () => beenden(Boolean(navigator.serviceWorker.controller));
      navigator.serviceWorker.addEventListener('controllerchange', gewechselt);

      setTimeout(() => beenden(Boolean(navigator.serviceWorker.controller)), timeoutMs);
    });
  }

  function scopeURL(registrierung) {
    return new URL(registrierung.scope);
  }

  function istImAppScope(url, scope) {
    return url.origin === scope.origin && url.pathname.startsWith(scope.pathname);
  }

  function urlOhneHash(url) {
    const kopie = new URL(url.href);
    kopie.hash = '';
    return kopie;
  }

  function sichereURL(wert, basis, scope) {
    if (!wert) return null;
    const roh = String(wert).trim();

    if (!roh ||
        roh.startsWith('#') ||
        roh.startsWith('data:') ||
        roh.startsWith('blob:') ||
        roh.startsWith('mailto:') ||
        roh.startsWith('tel:') ||
        roh.startsWith('javascript:')) {
      return null;
    }

    try {
      const url = urlOhneHash(new URL(roh, basis));
      return istImAppScope(url, scope) ? url : null;
    } catch (e) {
      return null;
    }
  }

  function istHTML(url) {
    const pfad = url.pathname.toLowerCase();
    return pfad.endsWith('.html') || pfad.endsWith('/');
  }

  function cssURLs(text, basis, scope) {
    const treffer = new Set();
    const regex = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const url = sichereURL(match[2], basis, scope);
      if (url) treffer.add(url.href);
    }
    return treffer;
  }

  function sammleAusDokument(doc, basis, scope) {
    const seiten = new Set();
    const ressourcen = new Set();

    doc.querySelectorAll('a[href]').forEach(element => {
      const url = sichereURL(element.getAttribute('href'), basis, scope);
      if (!url) return;
      if (istHTML(url)) seiten.add(url.href);
    });

    const attribute = [
      ['img[src]', 'src'],
      ['script[src]', 'src'],
      ['link[href]', 'href'],
      ['source[src]', 'src'],
      ['audio[src]', 'src'],
      ['video[src]', 'src'],
      ['track[src]', 'src'],
      ['iframe[src]', 'src'],
    ];

    for (const [selektor, attribut] of attribute) {
      doc.querySelectorAll(selektor).forEach(element => {
        const url = sichereURL(element.getAttribute(attribut), basis, scope);
        if (!url) return;
        if (istHTML(url)) seiten.add(url.href);
        else ressourcen.add(url.href);
      });
    }

    /* srcset-Bilder mitnehmen. */
    doc.querySelectorAll('[srcset]').forEach(element => {
      const srcset = element.getAttribute('srcset') || '';
      srcset.split(',').forEach(eintrag => {
        const kandidat = eintrag.trim().split(/\s+/)[0];
        const url = sichereURL(kandidat, basis, scope);
        if (url) ressourcen.add(url.href);
      });
    });

    /* Lokale Dateien aus Inline-CSS mitnehmen. */
    doc.querySelectorAll('style').forEach(style => {
      cssURLs(style.textContent || '', basis, scope).forEach(u => ressourcen.add(u));
    });

    doc.querySelectorAll('[style]').forEach(element => {
      cssURLs(element.getAttribute('style') || '', basis, scope).forEach(u => ressourcen.add(u));
    });

    return { seiten, ressourcen };
  }

  async function fetchFuerCache(url) {
    return fetch(url, {
      cache: 'reload',
      credentials: 'same-origin',
    });
  }

  async function aktuelleSeiteSichern() {
    if (!navigator.serviceWorker.controller || !navigator.onLine) return;
    try {
      await fetchFuerCache(location.href);
    } catch (e) {
      /* Offline/Netzfehler: vorhandener Cache bleibt unangetastet. */
    }
  }

  async function ressourcenPoolStarten(startURLs, scope) {
    const warteschlange = [...startURLs];
    const gesehen = new Set();
    let erfolgreich = 0;
    let fehlgeschlagen = 0;

    async function worker() {
      while (warteschlange.length && gesehen.size < MAX_RESSOURCEN) {
        const href = warteschlange.shift();
        if (!href || gesehen.has(href)) continue;
        gesehen.add(href);

        try {
          const antwort = await fetchFuerCache(href);
          if (!antwort.ok) {
            fehlgeschlagen++;
            continue;
          }

          erfolgreich++;

          const contentType = (antwort.headers.get('content-type') || '').toLowerCase();
          const istCSSDatei = contentType.includes('text/css') ||
                              new URL(href).pathname.toLowerCase().endsWith('.css');

          if (istCSSDatei && gesehen.size < MAX_RESSOURCEN) {
            const css = await antwort.clone().text();
            cssURLs(css, new URL(href), scope).forEach(url => {
              if (!gesehen.has(url) && (warteschlange.length + gesehen.size) < MAX_RESSOURCEN) {
                warteschlange.push(url);
              }
            });
          }
        } catch (e) {
          fehlgeschlagen++;
        }
      }
    }

    const anzahl = Math.min(RESSOURCEN_PARALLEL, Math.max(1, warteschlange.length));
    await Promise.all(Array.from({ length: anzahl }, () => worker()));

    return { erfolgreich, fehlgeschlagen, gesamt: gesehen.size };
  }

  async function unterseitenVorladen(registrierung) {
    if (vorladenLaeuft || !istStartseite() || !navigator.onLine) return;
    if (schonVorKurzemGeladen()) return;
    if (!navigator.serviceWorker.controller) return;

    vorladenLaeuft = true;

    try {
      const scope = scopeURL(registrierung);
      const seitenGesehen = new Set();
      const seitenQueue = [];
      const ressourcen = new Set();

      /* Mit der bereits im Browser vorhandenen index.html beginnen. */
      const start = sammleAusDokument(document, new URL(location.href), scope);
      start.seiten.forEach(u => seitenQueue.push(u));
      start.ressourcen.forEach(u => ressourcen.add(u));

      let seitenErfolgreich = 0;
      let seitenFehler = 0;

      while (seitenQueue.length && seitenGesehen.size < MAX_SEITEN) {
        const href = seitenQueue.shift();
        if (!href || seitenGesehen.has(href)) continue;
        seitenGesehen.add(href);

        try {
          const antwort = await fetchFuerCache(href);
          if (!antwort.ok) {
            seitenFehler++;
            continue;
          }

          seitenErfolgreich++;

          const html = await antwort.clone().text();
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const gefunden = sammleAusDokument(doc, new URL(href), scope);

          gefunden.seiten.forEach(url => {
            if (!seitenGesehen.has(url) && seitenQueue.length < MAX_SEITEN * 2) {
              seitenQueue.push(url);
            }
          });

          gefunden.ressourcen.forEach(url => {
            if (ressourcen.size < MAX_RESSOURCEN) ressourcen.add(url);
          });
        } catch (e) {
          seitenFehler++;
        }
      }

      const res = await ressourcenPoolStarten(ressourcen, scope);

      const seitenGesamt = seitenErfolgreich + seitenFehler;
      const seitenQuote = seitenGesamt === 0 ? 1 : seitenErfolgreich / seitenGesamt;

      /* Erst JETZT speichern – nicht vor dem Download.
         Ein einzelnes kaputtes Bild soll nicht täglich alles neu anstoßen.
         Bei massenhaft fehlgeschlagenen HTML-Seiten wird dagegen beim
         nächsten Start erneut versucht. */
      if (seitenQuote >= 0.80) {
        erfolgMerken();
      }

      console.info(
        '[Studjo] Offline-Vorladen beendet:',
        seitenErfolgreich + ' Seiten geladen,',
        seitenFehler + ' Seiten fehlgeschlagen,',
        res.erfolgreich + ' Ressourcen geladen,',
        res.fehlgeschlagen + ' Ressourcen fehlgeschlagen.'
      );
    } catch (fehler) {
      console.warn('[Studjo] Offline-Vorladen abgebrochen:', fehler);
    } finally {
      vorladenLaeuft = false;
    }
  }

  async function starten() {
    try {
      const registrierung = await navigator.serviceWorker.register('sw.js', {
        updateViaCache: 'none',
      });

      console.info('[Studjo] Service Worker registriert:', registrierung.scope);

      /* Direkt nach einer neueren sw.js fragen. */
      registrierung.update().catch(() => {});

      /* Kiosk/Startseite kann stundenlang offen bleiben. */
      setInterval(() => {
        registrierung.update().catch(() => {});
      }, 60 * 60 * 1000);

      await navigator.serviceWorker.ready;
      await warteAufController();

      await aktuelleSeiteSichern();

      /* Erst nach dem sichtbaren Seitenaufbau im Hintergrund loslegen. */
      if (istStartseite()) {
        setTimeout(() => {
          unterseitenVorladen(registrierung);
        }, 1200);
      }

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        /* Kein erzwungenes Reload: Die Nutzer sehen keine Sprünge.
           Der neue Worker kontrolliert ab jetzt die nächsten Requests. */
        setTimeout(async () => {
          await aktuelleSeiteSichern();
          if (istStartseite()) unterseitenVorladen(registrierung);
        }, 300);
      });

    } catch (fehler) {
      console.error('[Studjo] Service-Worker-Registrierung fehlgeschlagen:', fehler);
    }
  }

  starten();
})();
