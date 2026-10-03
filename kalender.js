/* ══════════════════════════════════════════════════════
   kalender.js – Kalender (Feiertage, Brückentage,
   Schließungstage, Schulferien)
   Studjo Infoterminal | Evangelisches Johanneswerk

   Unterstützt ZWEI Darstellungsarten, über dieselbe geteilte
   Logik und dieselben Daten:

     1. POPUP – für jedes Element mit data-kalender-oeffnen
        (z. B. der 📅-Button neben der Uhrzeit auf index.html).
        Öffnet sich als Overlay über der Seite.

     2. EINGEBETTET – für jedes Element mit
        data-kalender-einbetten (z. B. auf termine.html, fest
        sichtbar oberhalb der bestehenden Übersicht, kein
        Popup, kein Schließen-Button, immer sichtbar).

   Einbindung auf jeder Seite, die den Kalender anbieten will:
     <script src="feiertage.js"></script>
     <script src="kalender.js"></script>

   Führt DREI Datenquellen zusammen:
     1. NRW-Feiertage + Brückentage + Studjo-Zusatztage
        (aus feiertage.js, komplett offline berechnet)
     2. "Schließungstage" aus termine.html (per fetch ausgelesen,
        aus den dort ohnehin gepflegten event-card-Elementen –
        keine doppelte Pflege nötig). Mehrtägige Zeiträume: wenn
        eine Karte zusätzlich zu data-datum (Ende) ein
        data-start="YYYY-MM-DD" hat, wird der GANZE Zeitraum im
        Kalender markiert. Ohne data-start wird nur der in
        data-datum stehende Tag markiert.
     3. NRW-Schulferien von mehr-schulferien.de (rein informativ,
        keine Schließung). Rein optional: Schlägt der Abruf fehl,
        läuft der Rest des Kalenders unverändert weiter.
   ══════════════════════════════════════════════════════ */

(function () {

  function warten_auf_feiertage_js(cb) {
    if (window.StudjoFeiertage) { cb(); return; }
    setTimeout(() => warten_auf_feiertage_js(cb), 50);
  }

  warten_auf_feiertage_js(function () {
    const F = window.StudjoFeiertage;

    /* ── Geteilter Zustand (gilt für alle Darstellungen gleichzeitig) ── */
    let ansicht = new Date();
    let schliessungstageKarte = new Map(); // "YYYY-MM-DD" -> { titel, details: [] }
    let termineKarte = new Map();          // "YYYY-MM-DD" -> [{ kategorie, icon, titel, details }]
    let schulferienListe = [];             // [{ start, ende, name }]
    const ziele = [];                      // registrierte Anzeige-Ziele (Popup und/oder eingebettet)

    /* Welche Spalte aus termine.html bedeutet eine ECHTE Schließung
       (typ 'schliessung') und welche ist nur eine informative
       Terminankündigung (typ 'termin')? Zuordnung über die
       sichtbare Überschrift, nicht über CSS-Klassen (robuster).
       Eine unbekannte, künftig neu hinzugefügte Spalte wird
       automatisch als informativer Termin behandelt – es muss hier
       also nicht zwingend etwas ergänzt werden, wenn Marc später
       eine weitere Spalte hinzufügt. */
    const SPALTEN_KONFIG = {
      'Schließungstage': { typ: 'schliessung', icon: '🔒' },
      'Andachten':       { typ: 'termin',      icon: '⛪' },
      'Werkstattfeste':  { typ: 'termin',      icon: '🎪' },
      'Weitere Termine': { typ: 'termin',      icon: '📌' },
    };
    function konfigFuerUeberschrift(text) {
      for (const [schluessel, cfg] of Object.entries(SPALTEN_KONFIG)) {
        if (text.includes(schluessel)) return cfg;
      }
      return { typ: 'termin', icon: '📌' }; // unbekannte Spalte: informativ, keine Schließung
    }

    const ICON = { schliessung: '🔒', feiertag: '🎉', brueckentag: '🌉' };
    const HINTERGRUND = { schliessung: '#e5e9f5', feiertag: '#fde8ea', brueckentag: '#fff3d6' };
    const RAND = { schliessung: '#aab6e0', feiertag: '#f0b4ba', brueckentag: '#f0d090' };
    const TEXTFARBE = { schliessung: '#2a3a8c', feiertag: '#b61f29', brueckentag: '#8a5a00' };

    /* ══ DATENQUELLE 2: ALLE SPALTEN AUS termine.html ══
       Liest ALLE Termine-Spalten in einem Durchgang (Schließungstage,
       Andachten, Werkstattfeste, Weitere Termine, …) und sortiert sie
       anhand ihrer Überschrift in "Schließung" (löst "Studjo
       geschlossen" aus) oder "Termin" (rein informativ) ein.
       Schlägt der Abruf fehl, bleiben beide Karten leer – der Rest
       des Kalenders läuft normal weiter. */
    async function ladeTermineAusSeite() {
      try {
        const antwort = await fetch('termine.html');
        if (!antwort.ok) throw new Error('HTTP ' + antwort.status);
        const text = await antwort.text();
        const doc = new DOMParser().parseFromString(text, 'text/html');

        const neueSchliessungen = new Map();      // "YYYY-MM-DD" -> { titel, details }
        const neueTermine = new Map();            // "YYYY-MM-DD" -> [{ kategorie, icon, titel, details }]

        doc.querySelectorAll('.termine-column').forEach((spalte) => {
          const ueberschriftEl = spalte.querySelector('.termine-header-titel');
          if (!ueberschriftEl) return;
          const ueberschriftText = ueberschriftEl.textContent.trim();
          const cfg = konfigFuerUeberschrift(ueberschriftText);
          const kategorieName = ueberschriftText.replace(/^\S+\s*/, ''); // führendes Emoji weg

          spalte.querySelectorAll('.event-card[data-datum]').forEach((karte_el) => {
            const ende = karte_el.getAttribute('data-datum');
            const start = karte_el.getAttribute('data-start') || ende;
            const titelEl = karte_el.querySelector('.event-title');
            const titel = titelEl ? titelEl.textContent.trim() : kategorieName;
            const details = [];
            const zeitEl = karte_el.querySelector('.event-time');
            if (zeitEl && zeitEl.textContent.trim()) details.push(zeitEl.textContent.trim());
            const notizEl = karte_el.querySelector('.event-note');
            if (notizEl && notizEl.textContent.trim()) details.push(notizEl.textContent.trim());

            let d = new Date(start);
            const endDatum = new Date(ende);
            let sicherheitszaehler = 0;
            while (d <= endDatum && sicherheitszaehler < 400) {
              const schluessel = F.datumSchluessel(d);
              if (cfg.typ === 'schliessung') {
                neueSchliessungen.set(schluessel, { titel, details });
              } else {
                if (!neueTermine.has(schluessel)) neueTermine.set(schluessel, []);
                neueTermine.get(schluessel).push({ kategorie: kategorieName, icon: cfg.icon, titel, details });
              }
              d = F.tagePlus(d, 1);
              sicherheitszaehler++;
            }
          });
        });

        schliessungstageKarte = neueSchliessungen;
        termineKarte = neueTermine;
      } catch (e) {
        /* termine.html nicht erreichbar – kein Problem, der Kalender
           zeigt dann einfach nur Feiertage/Brückentage. */
      }
    }

    /* ══ DATENQUELLE 3: SCHULFERIEN (optional, gecacht) ══ */
    const FERIEN_CACHE_SCHLUESSEL = 'studjo-schulferien-cache-v1';
    const FERIEN_CACHE_GUELTIG_MS = 24 * 60 * 60 * 1000; // 1 Tag

    async function ladeSchulferien(jahr) {
      try {
        let cache = {};
        try { cache = JSON.parse(localStorage.getItem(FERIEN_CACHE_SCHLUESSEL)) || {}; } catch (e) {}
        const eintrag = cache[jahr];
        if (eintrag && (Date.now() - eintrag.zeit) < FERIEN_CACHE_GUELTIG_MS) return eintrag.daten;

        const url = 'https://www.mehr-schulferien.de/api/v2.1/federal-states/nordrhein-westfalen/periods' +
          '?start_date=' + jahr + '-01-01&end_date=' + jahr + '-12-31';
        const antwort = await fetch(url);
        if (!antwort.ok) throw new Error('HTTP ' + antwort.status);
        const ergebnis = await antwort.json();
        const daten = (ergebnis.data || [])
          .filter(e => e.is_school_vacation)
          .map(e => ({ start: e.starts_on, ende: e.ends_on, name: e.name }));

        cache[jahr] = { zeit: Date.now(), daten };
        try { localStorage.setItem(FERIEN_CACHE_SCHLUESSEL, JSON.stringify(cache)); } catch (e) {}
        return daten;
      } catch (e) {
        return []; // Bonus-Information – bei Fehler einfach keine Ferien anzeigen
      }
    }

    function schulferienFuerTag(schluessel) {
      return schulferienListe.find(f => schluessel >= f.start && schluessel <= f.ende) || null;
    }

    async function ladeSchulferienFuerSichtbaresJahr() {
      schulferienListe = await ladeSchulferien(ansicht.getFullYear());
    }

    /* ══ ZUSAMMENFÜHRUNG DER DREI QUELLEN FÜR EINEN TAG ══
       Priorität: 1. Schließungstage (Marc-kuratiert), 2. Feiertag
       (gesetzlich oder Studjo-Zusatztag), 3. Brückentag. Schulferien
       laufen unabhängig davon als Zusatzinfo mit. */
    function tagesInfo(datum) {
      const schluessel = F.datumSchluessel(datum);
      let primaer = null;

      if (schliessungstageKarte.has(schluessel)) {
        const e = schliessungstageKarte.get(schluessel);
        primaer = { art: 'schliessung', titel: e.titel, details: e.details };
      } else {
        const fb = F.pruefeFeiertagOderBrueckentag(datum);
        if (fb) {
          primaer = {
            art: fb.typ,
            titel: fb.name,
            details: fb.istWochenende ? [] : ['Studjo ist an diesem Tag geschlossen.'],
          };
        }
      }

      const ferien = schulferienFuerTag(schluessel);
      const termine = termineKarte.get(schluessel) || [];
      return { primaer, ferien, termine };
    }

    // Nach außen verfügbar machen (z. B. für die Zeitkachel auf index.html)
    window.StudjoKalender = window.StudjoKalender || {};
    window.StudjoKalender.tagesInfo = tagesInfo;

    /* ══ GEMEINSAMES MARKUP (innerer Teil – ohne Popup-Rahmen) ══
       idp = ID-Präfix, damit mehrere Ziele auf derselben Seite nie
       kollidieren (z. B. "kp" fürs Popup, "ke" fürs eingebettete). */
    function innererMarkup(idp) {
      return `
        <div style="display:flex; align-items:center; justify-content:center; gap:14px; margin-bottom:14px;">
          <button type="button" id="${idp}-zurueck" aria-label="Vorheriger Monat"
                  style="background:#f1f1f1; border:none; border-radius:10px; width:38px; height:38px;
                         font-size:1.1rem; cursor:pointer; flex-shrink:0;">◀</button>
          <h2 id="${idp}-titel" style="margin:0; color:#b61f29; font-size:1.2rem; font-weight:800;
                                        text-align:center; flex:1; min-width:0;">Monat Jahr</h2>
          <button type="button" id="${idp}-vor" aria-label="Nächster Monat"
                  style="background:#f1f1f1; border:none; border-radius:10px; width:38px; height:38px;
                         font-size:1.1rem; cursor:pointer; flex-shrink:0;">▶</button>
        </div>

        <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:3px; text-align:center;
                    font-size:0.72rem; font-weight:800; color:#8a8d8f; margin-bottom:4px;">
          <div>Mo</div><div>Di</div><div>Mi</div><div>Do</div><div>Fr</div><div>Sa</div><div>So</div>
        </div>

        <div id="${idp}-raster" style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px;"></div>

        <div style="display:flex; flex-wrap:wrap; gap:8px 14px; margin-top:14px; font-size:0.78rem; color:#0f2f37;">
          <span>🔒 Schließung</span>
          <span>🎉 Feiertag</span>
          <span>🌉 Brückentag</span>
          <span>📌 Termin</span>
          <span>🏖️ Schulferien</span>
          <span>📍 Heute</span>
        </div>

        <div id="${idp}-info"
             style="margin-top:14px; padding:12px; border-radius:10px; background:#f4f4f4;
                    line-height:1.5; font-size:0.95rem; color:#0f2f37; min-height:1.5em;">
          Tippe auf einen Tag für mehr Informationen.
        </div>

        <div id="${idp}-status" style="margin-top:8px; font-size:0.72rem; color:#8a8d8f; text-align:center;"></div>
      `;
    }

    /* Registriert ein Anzeige-Ziel (Popup-Innenbereich ODER
       eingebetteter Container), verdrahtet dessen Buttons und merkt
       es sich, damit zeichneAlle() es bei jeder Aktualisierung
       mit aktualisiert. */
    function registriereZiel(idp) {
      const ziel = {
        idp,
        titelEl: document.getElementById(idp + '-titel'),
        rasterEl: document.getElementById(idp + '-raster'),
        infoEl: document.getElementById(idp + '-info'),
        statusEl: document.getElementById(idp + '-status'),
      };
      ziele.push(ziel);

      document.getElementById(idp + '-zurueck').addEventListener('click', () => {
        ansicht.setMonth(ansicht.getMonth() - 1);
        zeichneAlle();
        ladeSchulferienFuerSichtbaresJahr().then(zeichneAlle);
      });
      document.getElementById(idp + '-vor').addEventListener('click', () => {
        ansicht.setMonth(ansicht.getMonth() + 1);
        zeichneAlle();
        ladeSchulferienFuerSichtbaresJahr().then(zeichneAlle);
      });

      return ziel;
    }

    /* ══ ZEICHNEN ══ */
    function zeichneZiel(ziel) {
      const jahr = ansicht.getFullYear();
      const monat = ansicht.getMonth();
      ziel.titelEl.textContent = F.MONATE[monat] + ' ' + jahr;
      ziel.rasterEl.innerHTML = '';

      const ersterTag = new Date(jahr, monat, 1);
      let startVersatz = ersterTag.getDay();
      startVersatz = startVersatz === 0 ? 6 : startVersatz - 1; // Montag-Start
      for (let i = 0; i < startVersatz; i++) ziel.rasterEl.appendChild(document.createElement('div'));

      const heute = new Date();
      const heuteSchluessel = F.datumSchluessel(heute);
      const tageImMonat = new Date(jahr, monat + 1, 0).getDate();

      for (let tag = 1; tag <= tageImMonat; tag++) {
        const datum = new Date(jahr, monat, tag);
        const { primaer, ferien, termine } = tagesInfo(datum);
        const istHeute = F.datumSchluessel(datum) === heuteSchluessel;
        const istWochenende = datum.getDay() === 0 || datum.getDay() === 6;

        const zelle = document.createElement('button');
        zelle.type = 'button';

        let hintergrund = istWochenende ? '#f5f5f5' : '#ffffff';
        let textfarbe = '#0f2f37';
        let rand = '1px solid #e5e5e5';
        let symbol = null;

        if (primaer) {
          hintergrund = HINTERGRUND[primaer.art];
          textfarbe = TEXTFARBE[primaer.art];
          rand = '1px solid ' + RAND[primaer.art];
          symbol = ICON[primaer.art];
        } else if (ferien) {
          hintergrund = '#fff8d6';
          rand = '1px solid #e8d27a';
          symbol = '🏖️';
        } else if (termine.length) {
          hintergrund = '#eef2ff';
          rand = '1px solid #c7d2fe';
          symbol = termine.length === 1 ? termine[0].icon : '📌';
        }
        if (istHeute) rand = '2px solid #b61f29';

        zelle.textContent = String(tag);
        zelle.style.cssText =
          'font-family:inherit; min-height:44px; border-radius:8px; cursor:pointer; font-size:0.95rem; font-weight:' +
          (istHeute ? '900' : '600') + '; display:flex; flex-direction:column; align-items:center; ' +
          'justify-content:center; gap:1px; background:' + hintergrund + '; color:' + textfarbe +
          '; border:' + rand + '; padding:2px;';

        const label = [
          F.WOCHENTAGE[datum.getDay()], tag + '.', F.MONATE[monat],
          primaer ? '– ' + primaer.titel : '',
          termine.length ? '– ' + termine.map(t => t.titel).join(', ') : '',
          ferien ? '– Schulferien: ' + ferien.name : '',
        ].filter(Boolean).join(' ');
        zelle.setAttribute('aria-label', label);

        if (symbol) {
          const symbolEl = document.createElement('span');
          symbolEl.setAttribute('aria-hidden', 'true');
          symbolEl.style.fontSize = '0.62rem';
          symbolEl.textContent = symbol;
          zelle.appendChild(symbolEl);
        }

        zelle.addEventListener('click', () => zeigeTagInfo(datum));
        ziel.rasterEl.appendChild(zelle);
      }
    }

    function zeichneAlle() { ziele.forEach(zeichneZiel); }

    function zeigeTagInfo(datum) {
      const { primaer, ferien, termine } = tagesInfo(datum);
      const datumText = F.WOCHENTAGE[datum.getDay()] + ', ' + datum.getDate() + '. ' +
        F.MONATE[datum.getMonth()] + ' ' + datum.getFullYear();

      const zeilen = ['<strong>' + datumText + '</strong>'];
      if (primaer) {
        zeilen.push(ICON[primaer.art] + ' ' + primaer.titel);
        primaer.details.forEach(d => zeilen.push(d));
      }
      termine.forEach(t => {
        zeilen.push(t.icon + ' ' + t.kategorie + ': ' + t.titel);
        t.details.forEach(d => zeilen.push(d));
      });
      if (ferien) zeilen.push('🏖️ Schulferien: ' + ferien.name);
      if (!primaer && !ferien && termine.length === 0) zeilen.push('Ganz normaler Tag.');

      ziele.forEach(ziel => { ziel.infoEl.innerHTML = zeilen.join('<br>'); });
    }

    async function ladeAlleDatenUndZeichneNeu() {
      ziele.forEach(z => { if (z.statusEl) z.statusEl.textContent = 'Lade Schließungstage und Schulferien …'; });
      await Promise.all([ladeTermineAusSeite(), ladeSchulferienFuerSichtbaresJahr()]);
      ziele.forEach(z => { if (z.statusEl) z.statusEl.textContent = ''; });
      zeichneAlle();
    }

    /* ══ MODUS 1: POPUP ══ */
    let popupLetzterFokus = null;

    function injiziereAlsPopup() {
      if (document.getElementById('kalender-overlay')) return;

      const html = `
<div id="kalender-overlay"
     role="dialog" aria-modal="true" aria-labelledby="kp-titel"
     style="display:none; position:fixed; inset:0; z-index:2100;
            background:rgba(0,0,0,0.6); align-items:center; justify-content:center; padding:20px;">
  <div style="background:#fff; border-radius:16px; padding:22px 22px 20px;
              text-align:left; max-width:420px; width:100%; position:relative;
              box-shadow:0 10px 40px rgba(0,0,0,0.35); max-height:90vh; overflow-y:auto;
              box-sizing:border-box;">
    <button type="button" id="kalender-schliessen-btn" aria-label="Kalender schließen"
            style="position:absolute; top:10px; right:10px; background:#f1f1f1; border:none;
                   border-radius:50%; width:32px; height:32px; font-size:1.1rem; cursor:pointer;
                   line-height:1;">✕</button>
    ${innererMarkup('kp')}
  </div>
</div>`;
      document.body.insertAdjacentHTML('beforeend', html);

      document.getElementById('kalender-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) schliesseKalenderPopup();
      });
      document.getElementById('kalender-schliessen-btn').addEventListener('click', schliesseKalenderPopup);
      document.addEventListener('keydown', (e) => {
        const overlay = document.getElementById('kalender-overlay');
        if (e.key === 'Escape' && overlay && overlay.style.display === 'flex') schliesseKalenderPopup();
      });

      registriereZiel('kp');
    }

    async function oeffneKalenderPopup() {
      injiziereAlsPopup();
      ansicht = new Date();
      popupLetzterFokus = document.activeElement;

      const overlay = document.getElementById('kalender-overlay');
      overlay.style.display = 'flex';
      document.getElementById('kp-info').innerHTML = 'Tippe auf einen Tag für mehr Informationen.';
      zeichneAlle();
      document.getElementById('kp-zurueck').focus();

      await ladeAlleDatenUndZeichneNeu();
    }

    function schliesseKalenderPopup() {
      const overlay = document.getElementById('kalender-overlay');
      if (overlay) overlay.style.display = 'none';
      if (popupLetzterFokus) popupLetzterFokus.focus();
    }

    /* ══ MODUS 2: FEST EINGEBETTET ══ */
    function renderAlsEingebettet(container) {
      container.innerHTML = `
        <div style="background:#fff; border-radius:16px; padding:20px 20px 18px; margin-bottom:22px;
                    box-shadow:0 2px 10px rgba(0,0,0,0.08); box-sizing:border-box;">
          <h2 style="margin:0 0 14px; color:#b61f29; font-size:1.3rem; font-weight:800; text-align:center;">
            📅 Kalender
          </h2>
          ${innererMarkup('ke')}
        </div>
      `;
      registriereZiel('ke');
      zeichneAlle();
      ladeAlleDatenUndZeichneNeu();
    }

    /* ══ AUSLÖSER / EINBETTUNGSPUNKTE AUF DER SEITE FINDEN ══ */
    function einrichten() {
      document.querySelectorAll('[data-kalender-oeffnen]').forEach((el) => {
        el.addEventListener('click', (e) => { e.preventDefault(); oeffneKalenderPopup(); });
      });
      document.querySelectorAll('[data-kalender-einbetten]').forEach((container) => {
        renderAlsEingebettet(container);
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', einrichten);
    } else {
      einrichten();
    }

    /* Schließungstage sofort beim Laden abrufen (nicht erst beim
       Öffnen/Einbetten) – nur so kann z. B. die Zeitkachel auf
       index.html von Anfang an erkennen "Heute ist Betriebsurlaub",
       auch ohne dass der Kalender geöffnet/eingebettet wurde. */
    ladeTermineAusSeite();
  });

})();
