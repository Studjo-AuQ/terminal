/* ══════════════════════════════════════════════════════
   nachrichten-deeplink.js
   Öffnet eine von der Tageskarte gewählte allgemeine Nachricht
   intern auf nachrichten-allgemein.html.

   Primärschlüssel: stabile RSS-ID.
   Titel wird nur als Rückwärtskompatibilitäts-Fallback verwendet.
   Kein zeitbasiertes 6-Sekunden-Polling: MutationObserver reagiert
   direkt auf das Ende des Feed-Ladens.
   ══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const params = new URLSearchParams(location.search);

  let quelle = String(params.get('quelle') || '')
    .trim()
    .toLowerCase();

  const id = String(params.get('id') || '').trim();
  const titelFallback = String(params.get('titel') || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!id && !titelFallback) return;

  if (
    ['nachrichten', 'nachrichtenleicht', 'dlf', 'deutschlandfunk']
      .includes(quelle)
  ) {
    quelle = 'leicht';
  }

  if (!['leicht', 'tagesschau', 'kobinet'].includes(quelle)) {
    quelle = 'leicht';
  }

  const KONFIG = {
    leicht: {
      gridId: 'grid-leicht',
      ladeId: 'lade-leicht',
      json: 'data/nachrichten.json'
    },
    tagesschau: {
      gridId: 'grid-tagesschau',
      ladeId: 'lade-tagesschau',
      json: 'data/tagesschau.json'
    },
    kobinet: {
      gridId: 'grid-kobinet',
      ladeId: 'lade-kobinet',
      json: 'data/kobinet.json'
    }
  };

  const cfg = KONFIG[quelle];
  let zielTitel = titelFallback;
  let erledigt = false;
  let fallbackLaeuft = false;
  let observer = null;

  function normalisiereTitel(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function tabButton() {
    return Array.from(document.querySelectorAll('.tab-btn'))
      .find(btn => {
        const onclick = String(btn.getAttribute('onclick') || '');
        return onclick.includes("'" + quelle + "'");
      }) || null;
  }

  function aktiviereTab() {
    const btn = tabButton();

    if (btn && typeof window.zeigeTab === 'function') {
      window.zeigeTab(quelle, btn);
    }
  }

  function findeKarte() {
    const grid = document.getElementById(cfg.gridId);
    if (!grid || !zielTitel) return null;

    const ziel = normalisiereTitel(zielTitel);

    return Array.from(grid.querySelectorAll('.news-card'))
      .find(karte => {
        const titel = normalisiereTitel(
          karte.querySelector('.card-titel')?.textContent
        );
        return titel === ziel;
      }) || null;
  }

  function oeffneKarte(karte) {
    if (!karte || erledigt) return;

    erledigt = true;
    if (observer) observer.disconnect();

    aktiviereTab();

    document.querySelectorAll('.news-card.offen')
      .forEach(k => k.classList.remove('offen'));

    karte.classList.add('offen');

    setTimeout(() => {
      karte.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 80);
  }

  async function titelAusStabilerId() {
    if (!id) return;

    try {
      const r = await fetch(
        cfg.json + '?v=' + Date.now(),
        { cache: 'no-store' }
      );

      if (!r.ok) return;

      const daten = await r.json();
      const meldung = (daten?.meldungen || [])
        .find(m => String(m?.id || '') === id);

      if (meldung?.title) {
        zielTitel = normalisiereTitel(meldung.title);
      }
    } catch (e) {
      /* Offline oder kurzzeitiger Fehler:
         Titel-Fallback bzw. tagesinfo.json bleibt verfügbar. */
    }
  }

  function findeGespeicherteNachricht(daten) {
    const vorgaben = Array.isArray(daten?.vorgaben)
      ? daten.vorgaben
      : [];

    for (const vorgabe of vorgaben) {
      const plaetze = Array.isArray(vorgabe?.plaetze)
        ? vorgabe.plaetze
        : [];

      for (const platz of plaetze) {
        const n = platz?.nachricht;
        if (!n) continue;

        if (id && String(n.id || '') === id) return n;

        if (
          !id &&
          titelFallback &&
          normalisiereTitel(n.titel || n.title) === titelFallback
        ) {
          return n;
        }
      }
    }

    return null;
  }

  async function fallbackAusTagesinfo() {
    if (fallbackLaeuft || erledigt) return;
    fallbackLaeuft = true;

    try {
      if (typeof window.erstelleKarte !== 'function') return;

      const r = await fetch(
        'data/tagesinfo.json?v=' + Date.now(),
        { cache: 'no-store' }
      );

      if (!r.ok) return;

      const daten = await r.json();
      const gespeichert = findeGespeicherteNachricht(daten);
      if (!gespeichert) return;

      const grid = document.getElementById(cfg.gridId);
      if (!grid) return;

      const meldung = {
        id: gespeichert.id || '',
        title: gespeichert.titel || gespeichert.title || zielTitel,
        description: gespeichert.text || '',
        pubDate: gespeichert.pubDate || '',
        bild: ''
      };

      zielTitel = normalisiereTitel(meldung.title);

      const karte = window.erstelleKarte(
        meldung,
        gespeichert.quelle || 'Studjo Tageskarte'
      );

      grid.prepend(karte);
      oeffneKarte(karte);

    } catch (e) {
      console.warn(
        '[Studjo Nachrichten] Gespeicherte Tageskarten-Nachricht konnte nicht geöffnet werden:',
        e
      );
    } finally {
      fallbackLaeuft = false;
    }
  }

  function feedIstFertig() {
    const ladebox = document.getElementById(cfg.ladeId);
    return !!ladebox && ladebox.style.display === 'none';
  }

  function pruefen() {
    if (erledigt) return;

    const karte = findeKarte();

    if (karte) {
      oeffneKarte(karte);
      return;
    }

    if (feedIstFertig()) {
      aktiviereTab();
      fallbackAusTagesinfo();
    }
  }

  async function starten() {
    /* Stabile ID zuerst gegen den aktuellen Feed auflösen.
       Dadurch bleibt der Deep-Link korrekt, auch wenn sich der Titel ändert. */
    await titelAusStabilerId();

    observer = new MutationObserver(pruefen);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style']
    });

    pruefen();
  }

  starten();

})();
