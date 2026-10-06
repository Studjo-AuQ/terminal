/* ══════════════════════════════════════════════════════
   kalender.js – Kalender für das Studjo Terminal
   Feiertage, Brückentage, Schließungen, Termine, Schulferien

   Darstellungsarten:
     1. POPUP über Elemente mit data-kalender-oeffnen
     2. EINGEBETTET über Elemente mit data-kalender-einbetten

   Datenquellen:
     1. feiertage.js:
        NRW-Feiertage, Studjo-Zusatztage und Brückentage
     2. termine.html:
        Andachten, Werkstattfeste, Schließungstage, weitere Termine
     3. mehr-schulferien.de:
        NRW-Schulferien als zusätzliche Information

   WICHTIG:
   - Mehrere Hinweise dürfen gleichzeitig auf demselben Tag liegen.
     Beispiel: Betriebsurlaub + Feiertag + Schulferien.
   - Mehrtägige Schließungen werden möglichst automatisch aus dem
     sichtbaren Datums-Text der Termin-Karte erkannt:
       "23. Dez. bis 05. Jan."
     data-datum bleibt dabei das ENDDATUM.
   - Optional kann data-start="YYYY-MM-DD" weiterhin verwendet werden,
     falls ein Sonderfall einmal nicht automatisch erkannt werden kann.
   ══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  function wartenAufFeiertageJs(cb) {
    if (window.StudjoFeiertage) {
      cb();
      return;
    }
    setTimeout(() => wartenAufFeiertageJs(cb), 50);
  }

  wartenAufFeiertageJs(function () {
    const F = window.StudjoFeiertage;

    /* ════════════════════════════════════════════════════
       GETEILTER ZUSTAND
       ════════════════════════════════════════════════════ */
    let ansicht = new Date();

    /* Pro Tag sind bewusst mehrere Schließungs-Karten möglich. */
    let schliessungstageKarte = new Map();
    // "YYYY-MM-DD" -> [{ art, titel, details, quelleTitel }]

    let termineKarte = new Map();
    // "YYYY-MM-DD" -> [{ kategorie, icon, titel, details }]

    let schulferienListe = [];
    // [{ start, ende, name }]

    const ziele = [];

    const SPALTEN_KONFIG = {
      'Schließungstage': { typ: 'schliessung', icon: '🔒' },
      'Andachten':       { typ: 'termin',       icon: '⛪' },
      'Werkstattfeste':  { typ: 'termin',       icon: '🎪' },
      'Weitere Termine': { typ: 'termin',       icon: '📌' },
    };

    function konfigFuerUeberschrift(text) {
      for (const [schluessel, cfg] of Object.entries(SPALTEN_KONFIG)) {
        if (text.includes(schluessel)) return cfg;
      }
      return { typ: 'termin', icon: '📌' };
    }

    const ICON = {
      schliessung: '🔒',
      feiertag: '🎉',
      brueckentag: '🌉',
    };

    const HINTERGRUND = {
      schliessung: '#e5e9f5',
      feiertag: '#fde8ea',
      brueckentag: '#fff3d6',
    };

    const RAND = {
      schliessung: '#aab6e0',
      feiertag: '#f0b4ba',
      brueckentag: '#f0d090',
    };

    const TEXTFARBE = {
      schliessung: '#2a3a8c',
      feiertag: '#b61f29',
      brueckentag: '#8a5a00',
    };


    /* ════════════════════════════════════════════════════
       DATUMS-HILFSFUNKTIONEN
       ════════════════════════════════════════════════════ */

    function parseIsoDatum(text) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text || '').trim());
      if (!m) return null;

      const jahr = Number(m[1]);
      const monat = Number(m[2]) - 1;
      const tag = Number(m[3]);

      const d = new Date(jahr, monat, tag);
      if (
        d.getFullYear() !== jahr ||
        d.getMonth() !== monat ||
        d.getDate() !== tag
      ) {
        return null;
      }
      return d;
    }

    function normalisiereMonat(text) {
      return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\./g, '')
        .trim();
    }

    const MONAT_INDEX = {
      jan: 0, januar: 0,
      feb: 1, februar: 1,
      mar: 2, maerz: 2, marz: 2, maart: 2,
      apr: 3, april: 3,
      mai: 4,
      jun: 5, juni: 5,
      jul: 6, juli: 6,
      aug: 7, august: 7,
      sep: 8, sept: 8, september: 8,
      okt: 9, oktober: 9,
      nov: 10, november: 10,
      dez: 11, dezember: 11,
    };

    function monatAusText(text) {
      const normal = normalisiereMonat(text);
      return Object.prototype.hasOwnProperty.call(MONAT_INDEX, normal)
        ? MONAT_INDEX[normal]
        : null;
    }

    function jahrAusKurzform(wert) {
      if (!wert) return null;
      const n = Number(wert);
      if (!Number.isFinite(n)) return null;
      if (String(wert).length === 2) return 2000 + n;
      if (String(wert).length === 4) return n;
      return null;
    }

    function ermittleStartdatum(karteEl, endeText) {
      const explizit = parseIsoDatum(karteEl.getAttribute('data-start'));
      if (explizit) return explizit;

      const ende = parseIsoDatum(endeText);
      if (!ende) return null;

      const datumEl = karteEl.querySelector('.event-date');
      const sichtbarerText = datumEl ? datumEl.textContent.trim() : '';

      if (!/\bbis\b/i.test(sichtbarerText)) {
        return new Date(ende);
      }

      const teile = sichtbarerText.split(/\bbis\b/i);
      if (teile.length < 2) return new Date(ende);

      let startTeil = teile[0]
        .replace(/^\s*vom\s+/i, '')
        .trim();

      const m = /(\d{1,2})\.\s*(?:([A-Za-zÄÖÜäöüß.]+)\s*)?(?:(\d{2,4}))?\s*$/.exec(startTeil);
      if (!m) return new Date(ende);

      const tag = Number(m[1]);
      const monatText = m[2] || '';
      const angegebenesJahr = jahrAusKurzform(m[3]);

      let monat = monatText ? monatAusText(monatText) : ende.getMonth();
      if (monat === null) return new Date(ende);

      let jahr = angegebenesJahr !== null
        ? angegebenesJahr
        : ende.getFullYear();

      if (angegebenesJahr === null && monat > ende.getMonth()) {
        jahr -= 1;
      }

      let start = new Date(jahr, monat, tag);

      if (angegebenesJahr === null && start > ende) {
        start = new Date(jahr - 1, monat, tag);
      }

      if (
        start.getMonth() !== monat ||
        start.getDate() !== tag ||
        start > ende
      ) {
        return new Date(ende);
      }

      return start;
    }

    function fuegeMapArrayHinzu(map, schluessel, wert) {
      if (!map.has(schluessel)) map.set(schluessel, []);
      map.get(schluessel).push(wert);
    }


    /* ════════════════════════════════════════════════════
       DATENQUELLE: termine.html
       ════════════════════════════════════════════════════ */

    async function ladeTermineAusSeite() {
      try {
        const antwort = await fetch('termine.html');
        if (!antwort.ok) throw new Error('HTTP ' + antwort.status);

        const text = await antwort.text();
        const doc = new DOMParser().parseFromString(text, 'text/html');

        const neueSchliessungen = new Map();
        const neueTermine = new Map();

        doc.querySelectorAll('.termine-column').forEach(spalte => {
          const ueberschriftEl = spalte.querySelector('.termine-header-titel');
          if (!ueberschriftEl) return;

          const ueberschriftText = ueberschriftEl.textContent.trim();
          const cfg = konfigFuerUeberschrift(ueberschriftText);
          const kategorieName = ueberschriftText.replace(/^\S+\s*/, '');

          spalte.querySelectorAll('.event-card[data-datum]').forEach(karteEl => {
            const endeText = karteEl.getAttribute('data-datum');
            const ende = parseIsoDatum(endeText);
            if (!ende) return;

            const start = ermittleStartdatum(karteEl, endeText) || new Date(ende);

            const titelEl = karteEl.querySelector('.event-title');
            const originalTitel = titelEl
              ? titelEl.textContent.trim()
              : kategorieName;

            const zeitEl = karteEl.querySelector('.event-time');
            const notizEl = karteEl.querySelector('.event-note');

            const zeit = zeitEl && zeitEl.textContent.trim()
              ? zeitEl.textContent.trim()
              : '';

            const notiz = notizEl && notizEl.textContent.trim()
              ? notizEl.textContent.trim()
              : '';

            let d = new Date(start);
            let sicherheitszaehler = 0;

            while (d <= ende && sicherheitszaehler < 400) {
              const schluessel = F.datumSchluessel(d);

              if (cfg.typ === 'schliessung') {
                const details = ['Studjo ganztägig geschlossen.'];

                if (
                  originalTitel &&
                  !/^(betriebsurlaub|betriebsferien)$/i.test(originalTitel)
                ) {
                  details.push(originalTitel);
                }

                if (
                  zeit &&
                  !/ganzt[aä]gig\s+geschlossen/i.test(zeit) &&
                  !/^betriebsferien$/i.test(zeit)
                ) {
                  details.push(zeit);
                }

                if (notiz) details.push(notiz);

                fuegeMapArrayHinzu(neueSchliessungen, schluessel, {
                  art: 'schliessung',
                  titel: 'Betriebsurlaub',
                  details,
                  quelleTitel: originalTitel,
                });

              } else {
                fuegeMapArrayHinzu(neueTermine, schluessel, {
                  kategorie: kategorieName,
                  icon: cfg.icon,
                  titel: originalTitel,
                  details: [zeit, notiz].filter(Boolean),
                });
              }

              d = F.tagePlus(d, 1);
              sicherheitszaehler++;
            }
          });
        });

        schliessungstageKarte = neueSchliessungen;
        termineKarte = neueTermine;

      } catch (e) {
        console.warn('[Studjo Kalender] Termine konnten nicht geladen werden:', e);
      }
    }


    /* ════════════════════════════════════════════════════
       DATENQUELLE: NRW-SCHULFERIEN
       ════════════════════════════════════════════════════ */

    const FERIEN_CACHE_SCHLUESSEL = 'studjo-schulferien-cache-v1';
    const FERIEN_CACHE_GUELTIG_MS = 24 * 60 * 60 * 1000;

    async function ladeSchulferien(jahr) {
      try {
        let cache = {};
        try {
          cache = JSON.parse(localStorage.getItem(FERIEN_CACHE_SCHLUESSEL)) || {};
        } catch (e) {}

        const eintrag = cache[jahr];
        if (
          eintrag &&
          (Date.now() - eintrag.zeit) < FERIEN_CACHE_GUELTIG_MS
        ) {
          return eintrag.daten;
        }

        const url =
          'https://www.mehr-schulferien.de/api/v2.1/federal-states/nordrhein-westfalen/periods' +
          '?start_date=' + jahr + '-01-01&end_date=' + jahr + '-12-31';

        const antwort = await fetch(url);
        if (!antwort.ok) throw new Error('HTTP ' + antwort.status);

        const ergebnis = await antwort.json();
        const daten = (ergebnis.data || [])
          .filter(e => e.is_school_vacation)
          .map(e => ({
            start: e.starts_on,
            ende: e.ends_on,
            name: e.name,
          }));

        cache[jahr] = {
          zeit: Date.now(),
          daten,
        };

        try {
          localStorage.setItem(
            FERIEN_CACHE_SCHLUESSEL,
            JSON.stringify(cache)
          );
        } catch (e) {}

        return daten;

      } catch (e) {
        return [];
      }
    }

    function schulferienFuerTag(schluessel) {
      return schulferienListe.find(
        f => schluessel >= f.start && schluessel <= f.ende
      ) || null;
    }

    async function ladeSchulferienFuerSichtbaresJahr() {
      schulferienListe = await ladeSchulferien(ansicht.getFullYear());
    }


    /* ════════════════════════════════════════════════════
       INFORMATIONEN EINES TAGES ZUSAMMENFÜHREN
       ════════════════════════════════════════════════════ */

    function tagesInfo(datum) {
      const schluessel = F.datumSchluessel(datum);

      const besondereTage = [];

      const schliessungen = schliessungstageKarte.get(schluessel) || [];
      schliessungen.forEach(e => besondereTage.push({
        art: 'schliessung',
        titel: e.titel,
        details: [...e.details],
      }));

      const fb = F.pruefeFeiertagOderBrueckentag(datum);
      if (fb) {
        besondereTage.push({
          art: fb.typ,
          titel: fb.name,
          details: fb.istWochenende
            ? []
            : ['Studjo ist an diesem Tag geschlossen.'],
        });
      }

      const ferien = schulferienFuerTag(schluessel);
      const termine = termineKarte.get(schluessel) || [];

      return {
        primaer: besondereTage.length ? besondereTage[0] : null,
        besondereTage,
        ferien,
        termine,
      };
    }

    window.StudjoKalender = window.StudjoKalender || {};
    window.StudjoKalender.tagesInfo = tagesInfo;


    /* ════════════════════════════════════════════════════
       MODERNE KALENDER-OPTIK
       ════════════════════════════════════════════════════ */

    function injiziereKalenderStyles() {
      if (document.getElementById('studjo-kalender-styles')) return;

      const style = document.createElement('style');
      style.id = 'studjo-kalender-styles';
      style.textContent = `
        .studjo-kal-nav {
          display:grid;
          grid-template-columns:40px minmax(0,1fr) auto 40px;
          align-items:center;
          gap:8px;
          margin-bottom:14px;
        }

        .studjo-kal-monat {
          margin:0;
          color:#b61f29;
          font-size:1.2rem;
          font-weight:900;
          text-align:center;
          line-height:1.2;
          min-width:0;
        }

        .studjo-kal-navbtn {
          width:40px;
          height:40px;
          border:none;
          border-radius:12px;
          background:#f2f3f5;
          color:#0f2f37;
          font:inherit;
          font-size:1.05rem;
          font-weight:900;
          cursor:pointer;
          display:flex;
          align-items:center;
          justify-content:center;
          transition:transform .15s ease, background .15s ease;
        }

        .studjo-kal-navbtn:hover {
          background:#e7e9ec;
          transform:translateY(-1px);
        }

        .studjo-kal-heute {
          min-width:68px;
          height:40px;
          padding:0 12px;
          border:2px solid #b61f29;
          border-radius:12px;
          background:#fff;
          color:#b61f29;
          font:inherit;
          font-size:.82rem;
          font-weight:900;
          cursor:pointer;
          transition:background .15s ease, color .15s ease;
        }

        .studjo-kal-heute:hover {
          background:#b61f29;
          color:#fff;
        }

        .studjo-kal-wochentage {
          display:grid;
          grid-template-columns:repeat(7,1fr);
          gap:4px;
          margin-bottom:5px;
          text-align:center;
          font-size:.72rem;
          font-weight:900;
          color:#6f7478;
        }

        .studjo-kal-wochentage > div:nth-child(6),
        .studjo-kal-wochentage > div:nth-child(7) {
          color:#8c9195;
        }

        .studjo-kal-raster {
          display:grid;
          grid-template-columns:repeat(7,1fr);
          gap:4px;
        }

        .studjo-kal-tag {
          position:relative;
          min-height:52px;
          border:1px solid #e4e7ea;
          border-radius:10px;
          padding:4px 2px 3px;
          background:#fff;
          color:#0f2f37;
          font:inherit;
          font-size:.95rem;
          font-weight:700;
          cursor:pointer;
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          gap:3px;
          overflow:visible;
          transition:transform .12s ease, box-shadow .12s ease, border-color .12s ease;
          z-index:1;
        }

        .studjo-kal-tag:hover {
          transform:translateY(-1px);
          box-shadow:0 3px 10px rgba(15,47,55,.10);
          z-index:3;
        }

        .studjo-kal-tag.kal-wochenende {
          background:#f6f7f8;
          color:#687076;
        }

        .studjo-kal-tag.kal-schliessung {
          background:#eef0fb;
          color:#2a3a8c;
          border-color:#b8c0e3;
        }

        .studjo-kal-tag.kal-feiertag {
          background:#fdebed;
          color:#a71923;
          border-color:#efbcc1;
        }

        .studjo-kal-tag.kal-brueckentag {
          background:#fff5dd;
          color:#835700;
          border-color:#efd79b;
        }

        .studjo-kal-tag.kal-ferien {
          background:#fff9dc;
          border-color:#ead783;
        }

        .studjo-kal-tag.kal-termin {
          background:#eef3ff;
          border-color:#c8d5fb;
        }

        .studjo-kal-tag.kal-heute {
          outline:3px solid #b61f29;
          outline-offset:-2px;
          font-weight:900;
          z-index:4;
        }

        .studjo-kal-tag.kal-heute::after {
          content:"";
          position:absolute;
          top:4px;
          right:4px;
          width:7px;
          height:7px;
          border-radius:50%;
          background:#b61f29;
        }

        .studjo-kal-tagnummer {
          font-size:.96rem;
          line-height:1;
        }

        .studjo-kal-symbole {
          min-height:12px;
          font-size:.60rem;
          line-height:1;
          white-space:nowrap;
          letter-spacing:-1px;
        }

        .studjo-kal-tag.kal-schliessung::before {
          content:"";
          position:absolute;
          top:0;
          left:5px;
          right:5px;
          height:5px;
          background:#6979c9;
          border-radius:8px 8px 3px 3px;
          z-index:2;
        }

        .studjo-kal-tag.kal-schliessung.kal-band-links::before {
          left:-3px;
          border-top-left-radius:0;
        }

        .studjo-kal-tag.kal-schliessung.kal-band-rechts::before {
          right:-3px;
          border-top-right-radius:0;
        }

        .studjo-kal-tag.kal-schliessung.kal-band-links.kal-band-rechts::before {
          border-radius:0;
        }

        .studjo-kal-legende {
          display:flex;
          flex-wrap:wrap;
          gap:7px;
          margin-top:14px;
        }

        .studjo-kal-legende span {
          display:inline-flex;
          align-items:center;
          gap:4px;
          padding:5px 9px;
          border-radius:999px;
          background:#f3f4f5;
          color:#394247;
          font-size:.73rem;
          font-weight:800;
          line-height:1;
        }

        .studjo-kal-info {
          margin-top:14px;
          padding:13px 14px;
          border-radius:12px;
          background:#f5f6f7;
          border-left:5px solid #b61f29;
          line-height:1.55;
          font-size:.95rem;
          color:#0f2f37;
          min-height:3.1em;
        }

        .studjo-kal-status {
          min-height:1em;
          margin-top:8px;
          font-size:.72rem;
          color:#8a8d8f;
          text-align:center;
        }

        @media (max-width:480px) {
          .studjo-kal-nav {
            grid-template-columns:36px minmax(0,1fr) auto 36px;
            gap:5px;
          }

          .studjo-kal-navbtn {
            width:36px;
            height:36px;
          }

          .studjo-kal-heute {
            min-width:58px;
            height:36px;
            padding:0 8px;
            font-size:.76rem;
          }

          .studjo-kal-monat {
            font-size:1.03rem;
          }

          .studjo-kal-raster {
            gap:3px;
          }

          .studjo-kal-tag {
            min-height:47px;
            border-radius:8px;
            font-size:.88rem;
          }

          .studjo-kal-legende span {
            font-size:.68rem;
            padding:4px 7px;
          }
        }
      `;

      document.head.appendChild(style);
    }


    /* ════════════════════════════════════════════════════
       GEMEINSAMES MARKUP
       ════════════════════════════════════════════════════ */

    function innererMarkup(idp) {
      return `
        <div class="studjo-kal-nav">
          <button type="button"
                  id="${idp}-zurueck"
                  class="studjo-kal-navbtn"
                  aria-label="Vorheriger Monat">◀</button>

          <h2 id="${idp}-titel"
              class="studjo-kal-monat">Monat Jahr</h2>

          <button type="button"
                  id="${idp}-heute"
                  class="studjo-kal-heute"
                  aria-label="Zum heutigen Tag springen">Heute</button>

          <button type="button"
                  id="${idp}-vor"
                  class="studjo-kal-navbtn"
                  aria-label="Nächster Monat">▶</button>
        </div>

        <div class="studjo-kal-wochentage" aria-hidden="true">
          <div>Mo</div><div>Di</div><div>Mi</div><div>Do</div>
          <div>Fr</div><div>Sa</div><div>So</div>
        </div>

        <div id="${idp}-raster"
             class="studjo-kal-raster"
             role="grid"
             aria-label="Monatskalender"></div>

        <div class="studjo-kal-legende" aria-label="Erklärung der Kalender-Symbole">
          <span>🔒 Schließung</span>
          <span>🎉 Feiertag</span>
          <span>🌉 Brückentag</span>
          <span>📌 Termin</span>
          <span>🏖️ Schulferien</span>
          <span>📍 Heute</span>
        </div>

        <div id="${idp}-info"
             class="studjo-kal-info"
             aria-live="polite">
          Tippe auf einen Tag für mehr Informationen.
        </div>

        <div id="${idp}-status"
             class="studjo-kal-status"
             aria-live="polite"></div>
      `;
    }


    /* ════════════════════════════════════════════════════
       ZIEL REGISTRIEREN
       ════════════════════════════════════════════════════ */

    function registriereZiel(idp) {
      const ziel = {
        idp,
        titelEl: document.getElementById(idp + '-titel'),
        rasterEl: document.getElementById(idp + '-raster'),
        infoEl: document.getElementById(idp + '-info'),
        statusEl: document.getElementById(idp + '-status'),
      };

      ziele.push(ziel);

      document
        .getElementById(idp + '-zurueck')
        .addEventListener('click', () => {
          ansicht = new Date(
            ansicht.getFullYear(),
            ansicht.getMonth() - 1,
            1
          );

          zeichneAlle();
          ladeSchulferienFuerSichtbaresJahr().then(zeichneAlle);
        });

      document
        .getElementById(idp + '-vor')
        .addEventListener('click', () => {
          ansicht = new Date(
            ansicht.getFullYear(),
            ansicht.getMonth() + 1,
            1
          );

          zeichneAlle();
          ladeSchulferienFuerSichtbaresJahr().then(zeichneAlle);
        });

      document
        .getElementById(idp + '-heute')
        .addEventListener('click', async () => {
          const heute = new Date();

          ansicht = new Date(
            heute.getFullYear(),
            heute.getMonth(),
            1
          );

          zeichneAlle();
          await ladeSchulferienFuerSichtbaresJahr();
          zeichneAlle();
          zeigeTagInfo(heute);
        });

      return ziel;
    }


    /* ════════════════════════════════════════════════════
       KALENDER ZEICHNEN
       ════════════════════════════════════════════════════ */

    function hatSchliessung(datum) {
      const info = tagesInfo(datum);
      return info.besondereTage.some(e => e.art === 'schliessung');
    }

    function symboleFuerTag(info) {
      const symbole = [];

      info.besondereTage.forEach(e => {
        if (ICON[e.art]) symbole.push(ICON[e.art]);
      });

      info.termine.forEach(t => {
        symbole.push(t.icon || '📌');
      });

      if (info.ferien) symbole.push('🏖️');

      return [...new Set(symbole)];
    }

    function zeichneZiel(ziel) {
      const jahr = ansicht.getFullYear();
      const monat = ansicht.getMonth();

      ziel.titelEl.textContent = F.MONATE[monat] + ' ' + jahr;
      ziel.rasterEl.innerHTML = '';

      const ersterTag = new Date(jahr, monat, 1);
      let startVersatz = ersterTag.getDay();
      startVersatz = startVersatz === 0 ? 6 : startVersatz - 1;

      for (let i = 0; i < startVersatz; i++) {
        const leer = document.createElement('div');
        leer.setAttribute('aria-hidden', 'true');
        ziel.rasterEl.appendChild(leer);
      }

      const heute = new Date();
      const heuteSchluessel = F.datumSchluessel(heute);
      const tageImMonat = new Date(jahr, monat + 1, 0).getDate();

      for (let tag = 1; tag <= tageImMonat; tag++) {
        const datum = new Date(jahr, monat, tag);
        const info = tagesInfo(datum);

        const istHeute =
          F.datumSchluessel(datum) === heuteSchluessel;

        const istWochenende =
          datum.getDay() === 0 || datum.getDay() === 6;

        const istSchliessung =
          info.besondereTage.some(e => e.art === 'schliessung');

        const zelle = document.createElement('button');
        zelle.type = 'button';
        zelle.className = 'studjo-kal-tag';
        zelle.setAttribute('role', 'gridcell');

        if (istWochenende) {
          zelle.classList.add('kal-wochenende');
        }

        if (istSchliessung) {
          zelle.classList.add('kal-schliessung');

          const gestern = F.tagePlus(datum, -1);
          const morgen = F.tagePlus(datum, 1);

          if (datum.getDay() !== 1 && hatSchliessung(gestern)) {
            zelle.classList.add('kal-band-links');
          }

          if (datum.getDay() !== 0 && hatSchliessung(morgen)) {
            zelle.classList.add('kal-band-rechts');
          }

        } else if (
          info.besondereTage.some(e => e.art === 'feiertag')
        ) {
          zelle.classList.add('kal-feiertag');

        } else if (
          info.besondereTage.some(e => e.art === 'brueckentag')
        ) {
          zelle.classList.add('kal-brueckentag');

        } else if (info.ferien) {
          zelle.classList.add('kal-ferien');

        } else if (info.termine.length) {
          zelle.classList.add('kal-termin');
        }

        if (istHeute) {
          zelle.classList.add('kal-heute');
        }

        const tagEl = document.createElement('span');
        tagEl.className = 'studjo-kal-tagnummer';
        tagEl.textContent = String(tag);
        zelle.appendChild(tagEl);

        const symbole = symboleFuerTag(info);
        const symbolEl = document.createElement('span');
        symbolEl.className = 'studjo-kal-symbole';
        symbolEl.setAttribute('aria-hidden', 'true');
        symbolEl.textContent = symbole.slice(0, 4).join('');
        zelle.appendChild(symbolEl);

        const labelTeile = [
          F.WOCHENTAGE[datum.getDay()],
          tag + '.',
          F.MONATE[monat],
        ];

        info.besondereTage.forEach(e => {
          labelTeile.push('– ' + e.titel);
        });

        if (info.termine.length) {
          labelTeile.push(
            '– ' +
            info.termine.map(t => t.titel).join(', ')
          );
        }

        if (info.ferien) {
          labelTeile.push(
            '– Schulferien: ' + info.ferien.name
          );
        }

        if (istHeute) {
          labelTeile.push('– Heute');
        }

        zelle.setAttribute(
          'aria-label',
          labelTeile.join(' ')
        );

        zelle.addEventListener(
          'click',
          () => zeigeTagInfo(datum)
        );

        ziel.rasterEl.appendChild(zelle);
      }
    }

    function zeichneAlle() {
      ziele.forEach(zeichneZiel);
    }


    /* ════════════════════════════════════════════════════
       DETAILANZEIGE EINES TAGES
       ════════════════════════════════════════════════════ */

    function htmlSicher(text) {
      return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function zeigeTagInfo(datum) {
      const info = tagesInfo(datum);

      const datumText =
        F.WOCHENTAGE[datum.getDay()] + ', ' +
        datum.getDate() + '. ' +
        F.MONATE[datum.getMonth()] + ' ' +
        datum.getFullYear();

      const zeilen = [
        '<strong>' + htmlSicher(datumText) + '</strong>',
      ];

      info.besondereTage.forEach(e => {
        zeilen.push(
          htmlSicher((ICON[e.art] || '📌') + ' ' + e.titel)
        );

        e.details.forEach(detail => {
          zeilen.push(htmlSicher(detail));
        });
      });

      info.termine.forEach(t => {
        zeilen.push(
          htmlSicher(
            t.icon + ' ' +
            t.kategorie + ': ' +
            t.titel
          )
        );

        t.details.forEach(detail => {
          zeilen.push(htmlSicher(detail));
        });
      });

      if (info.ferien) {
        zeilen.push(
          htmlSicher(
            '🏖️ Schulferien: ' +
            info.ferien.name
          )
        );
      }

      const istWochenende =
        datum.getDay() === 0 ||
        datum.getDay() === 6;

      if (istWochenende) {
        zeilen.push(
          'Studjo wünscht ein schönes Wochenende.'
        );
      } else if (
        info.besondereTage.length === 0 &&
        !info.ferien &&
        info.termine.length === 0
      ) {
        zeilen.push('Ganz normaler Tag.');
      }

      ziele.forEach(ziel => {
        ziel.infoEl.innerHTML = zeilen.join('<br>');
      });
    }


    /* ════════════════════════════════════════════════════
       DATEN LADEN
       ════════════════════════════════════════════════════ */

    async function ladeAlleDatenUndZeichneNeu() {
      ziele.forEach(ziel => {
        if (ziel.statusEl) {
          ziel.statusEl.textContent =
            'Lade Termine und Schulferien …';
        }
      });

      await Promise.all([
        ladeTermineAusSeite(),
        ladeSchulferienFuerSichtbaresJahr(),
      ]);

      ziele.forEach(ziel => {
        if (ziel.statusEl) {
          ziel.statusEl.textContent = '';
        }
      });

      zeichneAlle();
    }


    /* ════════════════════════════════════════════════════
       POPUP
       ════════════════════════════════════════════════════ */

    let popupLetzterFokus = null;

    function injiziereAlsPopup() {
      if (document.getElementById('kalender-overlay')) return;

      const html = `
<div id="kalender-overlay"
     role="dialog"
     aria-modal="true"
     aria-labelledby="kp-titel"
     style="display:none; position:fixed; inset:0; z-index:2100;
            background:rgba(0,0,0,0.6); align-items:center;
            justify-content:center; padding:20px;">

  <div style="background:#fff; border-radius:16px;
              padding:22px 22px 20px; text-align:left;
              max-width:470px; width:100%; position:relative;
              box-shadow:0 10px 40px rgba(0,0,0,0.35);
              max-height:90vh; overflow-y:auto;
              box-sizing:border-box;">

    <button type="button"
            id="kalender-schliessen-btn"
            aria-label="Kalender schließen"
            style="position:absolute; top:10px; right:10px;
                   background:#f1f1f1; border:none; border-radius:50%;
                   width:32px; height:32px; font-size:1.1rem;
                   cursor:pointer; line-height:1;">
      ✕
    </button>

    ${innererMarkup('kp')}
  </div>
</div>`;

      document.body.insertAdjacentHTML(
        'beforeend',
        html
      );

      document
        .getElementById('kalender-overlay')
        .addEventListener('click', e => {
          if (e.target === e.currentTarget) {
            schliesseKalenderPopup();
          }
        });

      document
        .getElementById('kalender-schliessen-btn')
        .addEventListener(
          'click',
          schliesseKalenderPopup
        );

      document.addEventListener('keydown', e => {
        const overlay =
          document.getElementById('kalender-overlay');

        if (
          e.key === 'Escape' &&
          overlay &&
          overlay.style.display === 'flex'
        ) {
          schliesseKalenderPopup();
        }
      });

      registriereZiel('kp');
    }

    async function oeffneKalenderPopup() {
      injiziereAlsPopup();

      ansicht = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      );

      popupLetzterFokus = document.activeElement;

      const overlay =
        document.getElementById('kalender-overlay');

      overlay.style.display = 'flex';

      document.getElementById('kp-info').innerHTML =
        'Tippe auf einen Tag für mehr Informationen.';

      zeichneAlle();

      document
        .getElementById('kp-heute')
        .focus();

      await ladeAlleDatenUndZeichneNeu();
    }

    function schliesseKalenderPopup() {
      const overlay =
        document.getElementById('kalender-overlay');

      if (overlay) {
        overlay.style.display = 'none';
      }

      if (popupLetzterFokus) {
        popupLetzterFokus.focus();
      }
    }


    /* ════════════════════════════════════════════════════
       FEST EINGEBETTET
       ════════════════════════════════════════════════════ */

    function renderAlsEingebettet(container) {
      container.innerHTML = `
        <div style="background:#fff; border-radius:18px;
                    padding:20px 20px 18px; margin-bottom:22px;
                    border:1px solid #eceeef;
                    box-shadow:0 8px 24px rgba(15,47,55,0.08);
                    box-sizing:border-box;">

          <h2 style="margin:0 0 14px; color:#b61f29;
                     font-size:1.3rem; font-weight:800;
                     text-align:center;">
            📅 Kalender
          </h2>

          ${innererMarkup('ke')}
        </div>
      `;

      registriereZiel('ke');
      zeichneAlle();
      ladeAlleDatenUndZeichneNeu();
    }


    /* ════════════════════════════════════════════════════
       INITIALISIERUNG
       ════════════════════════════════════════════════════ */

    function einrichten() {
      injiziereKalenderStyles();

      document
        .querySelectorAll('[data-kalender-oeffnen]')
        .forEach(el => {
          el.addEventListener('click', e => {
            e.preventDefault();
            oeffneKalenderPopup();
          });
        });

      document
        .querySelectorAll('[data-kalender-einbetten]')
        .forEach(container => {
          renderAlsEingebettet(container);
        });
    }

    if (document.readyState === 'loading') {
      document.addEventListener(
        'DOMContentLoaded',
        einrichten
      );
    } else {
      einrichten();
    }

    /* Schließungstage sofort laden, damit auch die Zeitkachel
       auf index.html direkt weiß, ob heute geschlossen ist. */
    ladeTermineAusSeite();
  });

})();
