/* ══════════════════════════════════════════════════════
   kacheln.js – Kacheln auf der Startseite individuell anordnen
   Studjo Infoterminal | Evangelisches Johanneswerk

   Läuft nur dort, wo es ein .card-grid gibt (also nur auf
   index.html) – auf jeder anderen Seite tut diese Datei einfach
   nichts. Keine Änderung an der bestehenden Kachel-Liste in
   index.html nötig: die Reihenfolge/Sichtbarkeit wird rein per
   JavaScript auf die vorhandenen Elemente angewendet.

   Speicherung: ausschließlich lokal auf diesem Gerät
   (localStorage) – passt zum Grundsatz "offline, kein Account,
   keine Cloud". Auf einem geteilten Kiosk-Tablet gilt die zuletzt
   eingestellte Reihenfolge für alle, die das Gerät danach nutzen;
   das ist ohne ein Benutzerkonto-System nicht anders lösbar.

   Bedienung:
     - ✏️-Button (im Footer, neben dem QR-Code) schaltet den
       Anordnen-Modus ein/aus.
     - Im Anordnen-Modus bekommt jede Kachel ◀ (nach vorne),
       ✕ (ausblenden) und ▶ (nach hinten). Bereits ausgeblendete
       Kacheln werden im Anordnen-Modus gedimmt mit einem einzelnen
       "↺ Wieder anzeigen"-Button gezeigt.
     - Ein "Zurücksetzen"-Button (erscheint nur im Anordnen-Modus)
       stellt die ursprüngliche Reihenfolge/Sichtbarkeit wieder her.
   ══════════════════════════════════════════════════════ */

(function () {

  const REIHENFOLGE_SCHLUESSEL = 'studjo-kachel-reihenfolge';
  const AUSGEBLENDET_SCHLUESSEL = 'studjo-kachel-ausgeblendet';

  function starten() {
    const grid = document.querySelector('.card-grid');
    const toggleBtn = document.getElementById('kacheln-anordnen-btn');
    if (!grid || !toggleBtn) return; // nicht auf dieser Seite

    let bearbeitungsModus = false;

    function ladeListe(schluessel) {
      try {
        const roh = localStorage.getItem(schluessel);
        return roh ? JSON.parse(roh) : null;
      } catch (e) { return null; }
    }
    function speichereListe(schluessel, liste) {
      try { localStorage.setItem(schluessel, JSON.stringify(liste)); } catch (e) { /* localStorage evtl. blockiert - Änderung gilt dann nur bis zum Neuladen */ }
    }

    function alleKacheln() {
      return [...grid.querySelectorAll(':scope > a.card')];
    }

    /* Gespeicherte Reihenfolge anwenden: vorhandene Kacheln in der
       gemerkten Reihenfolge neu einsortieren. Kacheln, die (noch)
       nicht in der gemerkten Liste stehen - z. B. weil Marc später
       eine neue Kachel ergänzt hat - werden einfach hinten
       angehängt, in ihrer ursprünglichen Reihenfolge. */
    function wendeReihenfolgeAn() {
      const gemerkt = ladeListe(REIHENFOLGE_SCHLUESSEL);
      if (!gemerkt) return;
      const kacheln = alleKacheln();
      const nachHref = new Map(kacheln.map(k => [k.getAttribute('href'), k]));
      gemerkt.forEach(href => {
        const kachel = nachHref.get(href);
        if (kachel) { grid.appendChild(kachel); nachHref.delete(href); }
      });
      nachHref.forEach(kachel => grid.appendChild(kachel)); // neue, noch unbekannte Kacheln ans Ende
    }

    function wendeAusgeblendetAn() {
      const ausgeblendet = new Set(ladeListe(AUSGEBLENDET_SCHLUESSEL) || []);
      alleKacheln().forEach(kachel => {
        const href = kachel.getAttribute('href');
        kachel.style.display = (!bearbeitungsModus && ausgeblendet.has(href)) ? 'none' : '';
      });
    }

    function aktuelleReihenfolgeSpeichern() {
      speichereListe(REIHENFOLGE_SCHLUESSEL, alleKacheln().map(k => k.getAttribute('href')));
    }

    function kachelAusblenden(href) {
      const liste = ladeListe(AUSGEBLENDET_SCHLUESSEL) || [];
      if (!liste.includes(href)) liste.push(href);
      speichereListe(AUSGEBLENDET_SCHLUESSEL, liste);
    }
    function kachelEinblenden(href) {
      const liste = (ladeListe(AUSGEBLENDET_SCHLUESSEL) || []).filter(h => h !== href);
      speichereListe(AUSGEBLENDET_SCHLUESSEL, liste);
    }
    function istAusgeblendet(href) {
      return (ladeListe(AUSGEBLENDET_SCHLUESSEL) || []).includes(href);
    }

    function steuerungsKnopf(symbol, label) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = symbol;
      btn.setAttribute('aria-label', label);
      btn.style.cssText =
        'pointer-events:auto; border:none; border-radius:8px; background:rgba(255,255,255,0.92);' +
        'color:#0f2f37; font-size:1.05rem; font-weight:800; cursor:pointer; padding:6px 10px; line-height:1;' +
        'box-shadow:0 2px 6px rgba(0,0,0,0.25);';
      return btn;
    }

    /* Zeichnet die Bedienelemente einer einzelnen Kachel im
       Anordnen-Modus (oder entfernt sie wieder, wenn der Modus
       verlassen wird). */
    function kachelSteuerungAktualisieren(kachel, index, anzahl) {
      const bestehend = kachel.querySelector(':scope > .kachel-steuerung');
      if (bestehend) bestehend.remove();
      if (!bearbeitungsModus) {
        kachel.style.opacity = '';
        kachel.style.outline = '';
        return;
      }

      const href = kachel.getAttribute('href');
      const leiste = document.createElement('div');
      leiste.className = 'kachel-steuerung';
      leiste.style.cssText =
        'position:absolute; inset:0; display:flex; align-items:center; justify-content:center;' +
        'gap:8px; background:rgba(15,47,55,0.55); border-radius:inherit; z-index:5;';

      kachel.style.position = 'relative';
      kachel.style.outline = '2px dashed rgba(182,31,41,0.6)';

      if (istAusgeblendet(href)) {
        kachel.style.opacity = '.45';
        const wiederBtn = steuerungsKnopf('↺ Wieder anzeigen', 'Kachel wieder einblenden');
        wiederBtn.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          kachelEinblenden(href);
          alleAktualisieren();
        });
        leiste.appendChild(wiederBtn);
      } else {
        kachel.style.opacity = '';
        const linksBtn = steuerungsKnopf('◀', 'Kachel nach vorne verschieben');
        const entfernenBtn = steuerungsKnopf('✕', 'Kachel ausblenden');
        const rechtsBtn = steuerungsKnopf('▶', 'Kachel nach hinten verschieben');

        linksBtn.disabled = index === 0;
        rechtsBtn.disabled = index === anzahl - 1;
        [linksBtn, rechtsBtn].forEach(b => { if (b.disabled) b.style.opacity = '.4'; });

        linksBtn.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          const vorherige = kachel.previousElementSibling;
          if (vorherige) { grid.insertBefore(kachel, vorherige); aktuelleReihenfolgeSpeichern(); alleAktualisieren(); }
        });
        rechtsBtn.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          const naechste = kachel.nextElementSibling;
          if (naechste) { grid.insertBefore(naechste, kachel); aktuelleReihenfolgeSpeichern(); alleAktualisieren(); }
        });
        entfernenBtn.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          kachelAusblenden(href);
          alleAktualisieren();
        });

        leiste.appendChild(linksBtn);
        leiste.appendChild(entfernenBtn);
        leiste.appendChild(rechtsBtn);
      }

      kachel.appendChild(leiste);
    }

    function alleAktualisieren() {
      wendeAusgeblendetAn();
      const kacheln = alleKacheln();
      kacheln.forEach((kachel, i) => kachelSteuerungAktualisieren(kachel, i, kacheln.length));
    }

    /* ── Obere Leiste: Fertig + Zurücksetzen (nur im Anordnen-Modus) ── */
    let aktionsLeiste = null;
    function aktionsLeisteAnzeigen() {
      if (aktionsLeiste) return;
      aktionsLeiste = document.createElement('div');
      aktionsLeiste.style.cssText =
        'display:flex; justify-content:center; gap:14px; margin:0 0 14px;';

      const hinweis = document.createElement('div');
      hinweis.textContent = 'Anordnen-Modus: Kacheln verschieben oder ausblenden, dann "Fertig" antippen.';
      hinweis.style.cssText =
        'width:100%; text-align:center; font-size:0.85rem; color:#0f2f37; background:#fff3d6;' +
        'border:1px solid #e8d27a; border-radius:10px; padding:10px 14px; margin-bottom:10px;';

      const zuruecksetzenBtn = document.createElement('button');
      zuruecksetzenBtn.type = 'button';
      zuruecksetzenBtn.textContent = '↺ Zurücksetzen';
      zuruecksetzenBtn.style.cssText =
        'background:#f1f1f1; color:#0f2f37; border:none; border-radius:999px; padding:10px 20px;' +
        'font-size:0.95rem; font-weight:700; cursor:pointer;';
      zuruecksetzenBtn.addEventListener('click', () => {
        try {
          localStorage.removeItem(REIHENFOLGE_SCHLUESSEL);
          localStorage.removeItem(AUSGEBLENDET_SCHLUESSEL);
        } catch (e) {}
        location.reload();
      });

      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'display:flex; flex-direction:column; align-items:center;';
      wrapper.appendChild(hinweis);
      wrapper.appendChild(zuruecksetzenBtn);
      aktionsLeiste = wrapper;
      grid.parentNode.insertBefore(aktionsLeiste, grid);
    }
    function aktionsLeisteEntfernen() {
      if (aktionsLeiste) { aktionsLeiste.remove(); aktionsLeiste = null; }
    }

    toggleBtn.addEventListener('click', () => {
      bearbeitungsModus = !bearbeitungsModus;
      toggleBtn.setAttribute('aria-pressed', String(bearbeitungsModus));
      toggleBtn.textContent = bearbeitungsModus ? '✓' : '✏️';
      toggleBtn.setAttribute('aria-label', bearbeitungsModus ? 'Anordnen beenden' : 'Kacheln anordnen');
      if (bearbeitungsModus) aktionsLeisteAnzeigen(); else aktionsLeisteEntfernen();
      alleAktualisieren();
    });

    // Beim Laden: gespeicherte Reihenfolge/Sichtbarkeit sofort anwenden
    wendeReihenfolgeAn();
    wendeAusgeblendetAn();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', starten);
  } else {
    starten();
  }

})();


/* ══════════════════════════════════════════════════════
   STARTSEITE: „Heute bei Studjo …“ – Tageskarte, Stufe 1

   Die Tageskarte wird bewusst NICHT als normale Navigationskachel
   angelegt. Sie wird automatisch direkt vor .card-grid eingefügt.
   So bleibt sie unabhängig von der individuell gespeicherten
   Kachel-Reihenfolge immer oberhalb von „Neuigkeiten“.

   Datenquellen:
     - data/termine.json über window.StudjoKalender
     - data/aba.json
     - data/wochenmottos.json
     - data/losungen.json
     - data/wetter.json
     - data/speiseplan-kurz.json (automatisch aus Speiseplan-PDFs erzeugt)
     - data/tagesinfo.json (spätere Admin-Vorgaben)

   Wichtige Regeln:
     - Schulferien werden hier NIE angezeigt.
     - Maximal ein Termin-Hinweis belegt einen Platz.
     - Montags hat das neue Wochenmotto Vorrang.
     - Wetter wird nur gezeigt, wenn wetter.json von heute ist.
     - Die übrige Auswahl ist pro Kalendertag stabil: Ein Neuladen
       der Seite erzeugt am selben Tag keine andere Zusammenstellung.
     - Mittagessen wird aus einem kleinen vorbereiteten JSON gelesen.
       Die OCR läuft einmalig in GitHub Actions, nicht auf dem Endgerät.
   ══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const ANZAHL_STANDARD = 3;
  const START_MONTAG_UTC = Date.UTC(2025, 11, 29); // ISO-KW 1/2026
  const WOCHE_MS = 7 * 24 * 60 * 60 * 1000;
  const ADMIN_DATEI = 'data/tagesinfo.json';

  let vorlesenAktiv = false;
  let aktuelleAussage = null;
  let tageskartenTimer = null;
  let aktualisierungLaeuft = false;
  let aktualisierungNochmal = false;

  function $(id) {
    return document.getElementById(id);
  }

  function isoDatum(datum) {
    return [
      datum.getFullYear(),
      String(datum.getMonth() + 1).padStart(2, '0'),
      String(datum.getDate()).padStart(2, '0')
    ].join('-');
  }

  function datumSchluesselOhneStriche(datum) {
    return Number(
      String(datum.getFullYear()) +
      String(datum.getMonth() + 1).padStart(2, '0') +
      String(datum.getDate()).padStart(2, '0')
    );
  }

  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function stabileSortierung(liste, datum, zusatz = '') {
    const tag = isoDatum(datum);
    return [...liste].sort((a, b) => {
      const ah = hash(tag + '|' + zusatz + '|' + (a.id || a.typ || a.text || 'a'));
      const bh = hash(tag + '|' + zusatz + '|' + (b.id || b.typ || b.text || 'b'));
      return ah - bh;
    });
  }

  async function ladeJson(pfad, optional = false) {
    try {
      const antwort = await fetch(pfad + '?v=' + Date.now(), { cache: 'no-store' });
      if (!antwort.ok) throw new Error('HTTP ' + antwort.status + ' bei ' + pfad);
      return await antwort.json();
    } catch (fehler) {
      if (!optional) {
        console.warn('[Studjo Tageskarte] Daten konnten nicht geladen werden:', pfad, fehler);
      }
      return null;
    }
  }

  function zeitwert(text, ende = false) {
    const roh = String(text || '').trim();
    if (!roh) return null;

    let normalisiert = roh;

    if (/^\d{4}-\d{2}-\d{2}$/.test(roh)) {
      normalisiert = roh + (ende ? 'T23:59:59' : 'T00:00:00');
    } else if (
      ende &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(roh)
    ) {
      /* Pflegezentrale speichert Minuten. "bis 23:59" soll daher
         die gesamte Minute bis 23:59:59 einschließen. */
      normalisiert = roh + ':59';
    }

    const d = new Date(normalisiert);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function aktiveAdminVorgabe(admin, jetzt) {
    if (!admin || !Array.isArray(admin.vorgaben)) return null;

    return admin.vorgaben
      .filter(v => v && v.aktiv !== false)
      .filter(v => {
        const von = zeitwert(v.von || v.datum, false);
        const bis = zeitwert(v.bis || v.von || v.datum, true);
        return von && bis && jetzt >= von && jetzt <= bis;
      })
      /* Bei Überschneidungen gilt die später beginnende Vorgabe. */
      .sort((a, b) => String(b.von || b.datum || '').localeCompare(String(a.von || a.datum || '')))[0] || null;
  }

  function naechsteTageskartenGrenze(admin, jetzt) {
    const kandidaten = [];

    /* Mitternacht: Datum, Termine, Motto und Zufallsauswahl ändern sich. */
    const mitternacht = new Date(jetzt);
    mitternacht.setDate(mitternacht.getDate() + 1);
    mitternacht.setHours(0, 0, 2, 0);
    kandidaten.push(mitternacht);

    /* 13:15 Uhr: Mittagessen wechselt auf den Folgetag. */
    const essenGrenze = new Date(jetzt);
    essenGrenze.setHours(13, 15, 1, 0);
    if (essenGrenze <= jetzt) essenGrenze.setDate(essenGrenze.getDate() + 1);
    kandidaten.push(essenGrenze);

    /* Beginn und Ende von Admin-Zeitsteuerungen. */
    if (Array.isArray(admin?.vorgaben)) {
      admin.vorgaben
        .filter(v => v && v.aktiv !== false)
        .forEach(v => {
          const von = zeitwert(v.von || v.datum, false);
          const bis = zeitwert(v.bis || v.von || v.datum, true);

          if (von && von > jetzt) kandidaten.push(von);

          if (bis) {
            const nachEnde = new Date(bis.getTime() + 1000);
            if (nachEnde > jetzt) kandidaten.push(nachEnde);
          }
        });
    }

    return kandidaten
      .filter(d => d instanceof Date && !Number.isNaN(d.getTime()) && d > jetzt)
      .sort((a, b) => a - b)[0] || null;
  }

  function planeTageskartenAktualisierung(admin, jetzt) {
    clearTimeout(tageskartenTimer);
    tageskartenTimer = null;

    const naechste = naechsteTageskartenGrenze(admin, jetzt);
    if (!naechste) return;

    const MAX_TIMEOUT = 2147480000;
    const wartezeit = Math.max(
      250,
      Math.min(MAX_TIMEOUT, naechste.getTime() - Date.now() + 150)
    );

    tageskartenTimer = setTimeout(() => {
      tageskarteAktualisieren();
    }, wartezeit);
  }

  function kuerzen(text, max = 112) {
    const sauber = String(text || '').replace(/\s+/g, ' ').trim();
    if (sauber.length <= max) return sauber;
    const teil = sauber.slice(0, max);
    const leer = teil.lastIndexOf(' ');
    return (leer > 60 ? teil.slice(0, leer) : teil).trim() + '…';
  }

  function injiziereStyles() {
    if ($('studjo-tagesinfo-styles')) return;

    const style = document.createElement('style');
    style.id = 'studjo-tagesinfo-styles';
    style.textContent = `
      .tagesinfo-box {
        position:relative;
        width:100%;
        box-sizing:border-box;
        margin:0 0 18px;
        padding:7px 10px 10px;
        background:#eef0f1;
        border:1px solid #d9dddf;
        border-radius:18px;
        box-shadow:0 3px 12px rgba(15,47,55,.08);
      }

      .tagesinfo-kopf {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        margin-bottom:6px;
      }

      .tagesinfo-titel {
        margin:0;
        color:#0f2f37;
        font-size:1.05rem;
        font-weight:900;
        line-height:1.2;
      }

      .tagesinfo-ohr {
        flex:0 0 auto;
        width:36px;
        height:36px;
        border:2px solid #b61f29;
        border-radius:50%;
        background:#fff;
        color:#b61f29;
        font-size:1.15rem;
        line-height:1;
        cursor:pointer;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:0;
        touch-action:manipulation;
      }

      .tagesinfo-ohr:hover,
      .tagesinfo-ohr:focus-visible {
        background:#fff6f6;
        outline:3px solid rgba(182,31,41,.18);
        outline-offset:2px;
      }

      .tagesinfo-ohr.aktiv {
        background:#ffe600;
        color:#111;
        border-color:#111;
      }

      .tagesinfo-liste {
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:0;
        background:#fff;
        border-radius:14px;
        overflow:hidden;
        border:1px solid #e0e3e4;
      }

      .tagesinfo-item {
        min-width:0;
        display:grid;
        grid-template-columns:48px minmax(0,1fr);
        gap:10px;
        align-items:center;
        padding:14px 15px;
        color:#0f2f37;
        text-decoration:none;
        background:#fff;
        box-sizing:border-box;
        transition:background .15s ease;
      }

      .tagesinfo-item + .tagesinfo-item {
        border-left:1px solid #e2e5e6;
      }

      .tagesinfo-item:hover,
      .tagesinfo-item:focus-visible {
        background:#fff8f8;
        outline:none;
      }

      .tagesinfo-item.is-reading {
        background:#ffe600 !important;
        color:#111 !important;
        border-radius:0 !important;
        box-shadow:none !important;
        transform:none !important;
      }

      .tagesinfo-emoji {
        width:44px;
        height:44px;
        border-radius:12px;
        background:#f3f4f5;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:1.65rem;
        line-height:1;
      }

      .tagesinfo-item.is-reading .tagesinfo-emoji {
        background:rgba(255,255,255,.55);
      }

      .tagesinfo-inhalt {
        min-width:0;
      }

      .tagesinfo-rubrik {
        display:block;
        margin:0 0 3px;
        color:#6f7478;
        font-size:.66rem;
        font-weight:900;
        text-transform:uppercase;
        letter-spacing:.055em;
        line-height:1.15;
      }

      .tagesinfo-text {
        display:block;
        color:#a71923;
        font-size:1.02rem;
        font-weight:800;
        line-height:1.28;
        text-decoration:none;
        white-space:pre-line;
      }

      .tagesinfo-text::after {
        content:'  ›';
        text-decoration:none;
        white-space:nowrap;
      }

      .tagesinfo-item.is-reading .tagesinfo-rubrik,
      .tagesinfo-item.is-reading .tagesinfo-text {
        color:#111 !important;
      }

      .tagesinfo-status {
        margin:8px 2px 0;
        color:#74797c;
        font-size:.72rem;
        line-height:1.3;
      }

      @media (max-width:700px) {
        .tagesinfo-box {
          padding:6px 8px 9px;
          margin-bottom:16px;
        }

        .tagesinfo-kopf {
          margin:0 2px 5px;
        }

        .tagesinfo-titel {
          font-size:1rem;
        }

        .tagesinfo-ohr {
          width:34px;
          height:34px;
        }

        .tagesinfo-liste {
          grid-template-columns:1fr;
        }

        .tagesinfo-item {
          grid-template-columns:46px minmax(0,1fr);
          padding:12px 12px;
        }

        .tagesinfo-item + .tagesinfo-item {
          border-left:0;
          border-top:1px solid #e2e5e6;
        }

        .tagesinfo-emoji {
          width:42px;
          height:42px;
          font-size:1.55rem;
        }

        .tagesinfo-text {
          font-size:1rem;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function baueGrundgeruest(grid) {
    if ($('tagesinfo-box')) return $('tagesinfo-box');

    const box = document.createElement('section');
    box.id = 'tagesinfo-box';
    box.className = 'tagesinfo-box';
    box.setAttribute('aria-labelledby', 'tagesinfo-titel');
    box.innerHTML = `
      <div class="tagesinfo-kopf">
        <h2 class="tagesinfo-titel" id="tagesinfo-titel">Heute bei Studjo …</h2>
        <button type="button" class="tagesinfo-ohr" id="tagesinfo-ohr"
                aria-label="Die drei Tipps vorlesen" aria-pressed="false"
                title="Die drei Tipps vorlesen">👂</button>
      </div>
      <div class="tagesinfo-liste" id="tagesinfo-liste" aria-live="polite"></div>
      <p class="tagesinfo-status" id="tagesinfo-status" hidden></p>
    `;

    grid.parentNode.insertBefore(box, grid);
    $('tagesinfo-ohr').addEventListener('click', vorlesenUmschalten);
    return box;
  }

  function stoppVorlesen() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    vorlesenAktiv = false;
    aktuelleAussage = null;
    document.querySelectorAll('#tagesinfo-box .is-reading')
      .forEach(el => el.classList.remove('is-reading'));

    const btn = $('tagesinfo-ohr');
    if (btn) {
      btn.classList.remove('aktiv');
      btn.setAttribute('aria-pressed', 'false');
    }
  }

  function vorlesenUmschalten() {
    if (!('speechSynthesis' in window)) {
      alert('Dein Browser unterstützt leider keine Sprachausgabe.');
      return;
    }

    if (vorlesenAktiv || window.speechSynthesis.speaking) {
      stoppVorlesen();
      return;
    }

    const zeilen = Array.from(document.querySelectorAll('#tagesinfo-liste .tagesinfo-item'));
    if (!zeilen.length) return;

    vorlesenAktiv = true;
    const btn = $('tagesinfo-ohr');
    btn.classList.add('aktiv');
    btn.setAttribute('aria-pressed', 'true');

    const elemente = [
      { text: 'Heute bei Studjo.', element: null },
      ...zeilen.map(zeile => ({
        text: (
          (zeile.querySelector('.tagesinfo-rubrik')?.textContent || '') + '. ' +
          (zeile.querySelector('.tagesinfo-text')?.textContent || '')
        ).replace(/\p{Extended_Pictographic}/gu, '').replace(/\s+/g, ' ').trim(),
        element: zeile
      }))
    ];

    function spiele(index) {
      if (!vorlesenAktiv || index >= elemente.length) {
        stoppVorlesen();
        return;
      }

      const abschnitt = elemente[index];
      aktuelleAussage = new SpeechSynthesisUtterance(abschnitt.text);
      aktuelleAussage.lang = 'de-DE';
      aktuelleAussage.rate = 0.9;

      aktuelleAussage.onstart = () => {
        document.querySelectorAll('#tagesinfo-box .is-reading')
          .forEach(el => el.classList.remove('is-reading'));
        if (abschnitt.element) abschnitt.element.classList.add('is-reading');
      };

      aktuelleAussage.onend = () => {
        setTimeout(() => spiele(index + 1), 180);
      };

      aktuelleAussage.onerror = stoppVorlesen;
      window.speechSynthesis.speak(aktuelleAussage);
    }

    spiele(0);
  }

  function parseIso(text) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text || '').trim());
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function montag(datum) {
    const d = new Date(datum);
    d.setHours(0, 0, 0, 0);
    const tag = d.getDay();
    d.setDate(d.getDate() + (tag === 0 ? -6 : 1 - tag));
    return d;
  }

  function wochenSeitReferenz(daten, wochenMontag) {
    const ref = parseIso(daten?.programm?.referenzDatum) ||
                parseIso(daten?.programm?.gueltigVon) ||
                new Date(2026, 3, 1);
    return Math.round((wochenMontag - montag(ref)) / WOCHE_MS);
  }

  function nterWochentag(jahr, monat, wochentag, n) {
    const d = new Date(jahr, monat, 1);
    while (d.getDay() !== wochentag) d.setDate(d.getDate() + 1);
    d.setDate(d.getDate() + 7 * (Math.max(1, Number(n) || 1) - 1));
    return d;
  }

  function abaFindetStatt(daten, angebot, heute) {
    if (angebot.sichtbar === false || angebot.typ !== 'regelmaessig') return false;
    if (Number(angebot.wochentag) !== heute.getDay()) return false;

    const tag = new Date(heute);
    tag.setHours(0, 0, 0, 0);
    const ab = parseIso(angebot.aktivAb);
    const bis = parseIso(angebot.aktivBis);
    if (ab && tag < ab) return false;
    if (bis && tag > bis) return false;

    const wm = montag(heute);
    const rhythmus = angebot.rhythmus || 'woechentlich';

    if (rhythmus === 'woechentlich') return true;

    if (rhythmus === '14taegig') {
      const diff = wochenSeitReferenz(daten, wm);
      const gerade = ((diff % 2) + 2) % 2 === 0;
      return angebot.referenzFindet === false ? !gerade : gerade;
    }

    if (rhythmus === 'monatlich') {
      const soll = nterWochentag(
        heute.getFullYear(),
        heute.getMonth(),
        Number(angebot.wochentag) || 1,
        angebot.monatlichWoche || 1
      );
      return heute.getFullYear() === soll.getFullYear() &&
             heute.getMonth() === soll.getMonth() &&
             heute.getDate() === soll.getDate();
    }

    return false;
  }

  async function kandidatAba(heute) {
    if (heute.getDay() === 0 || heute.getDay() === 6) return null;

    const daten = await ladeJson('data/aba.json');
    if (!daten || !Array.isArray(daten.angebote)) return null;

    const gueltigVon = parseIso(daten?.programm?.gueltigVon);
    const gueltigBis = parseIso(daten?.programm?.gueltigBis);
    const tag = new Date(heute);
    tag.setHours(0, 0, 0, 0);
    if (gueltigVon && tag < gueltigVon) return null;
    if (gueltigBis && tag > gueltigBis) return null;

    const passend = daten.angebote.filter(a => abaFindetStatt(daten, a, heute));
    if (!passend.length) return null;

    const angebot = stabileSortierung(passend, heute, 'aba')[0];
    const standort = (daten.standorte || []).find(s => s.id === angebot.standort);
    const ort = standort?.kurzname || standort?.name || '';
    const zeit = String(angebot.zeit || '').trim();

    return {
      id: 'aba',
      typ: 'aba',
      rubrik: 'AbA-Tipp',
      emoji: '🧩',
      text: [angebot.name, ort, zeit].filter(Boolean).join(' · '),
      href: standort?.seite || 'aba.html'
    };
  }

  function montagDerWocheUTC(datum) {
    const d = new Date(Date.UTC(datum.getFullYear(), datum.getMonth(), datum.getDate()));
    const tag = d.getUTCDay();
    const bisMontag = tag === 0 ? -6 : 1 - tag;
    d.setUTCDate(d.getUTCDate() + bisMontag);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  function positiveModulo(zahl, teiler) {
    return ((zahl % teiler) + teiler) % teiler;
  }

  async function kandidatMotto(heute) {
    const daten = await ladeJson('data/wochenmottos.json');
    const liste = Array.isArray(daten?.wochenmottos) ? daten.wochenmottos : [];
    if (!liste.length) return null;

    const wochenSeitStart = Math.round((montagDerWocheUTC(heute) - START_MONTAG_UTC) / WOCHE_MS);
    const nr = positiveModulo(wochenSeitStart, liste.length) + 1;
    const eintrag = liste.find(m => Number(m.woche) === nr);
    if (!eintrag) return null;

    return {
      id: 'motto',
      typ: 'motto',
      rubrik: 'Wochenmotto',
      emoji: eintrag.emoji || '📖',
      text: kuerzen(eintrag.motto, 105),
      href: 'wochenmotto.html'
    };
  }

  async function kandidatLosung(heute) {
    const daten = await ladeJson('data/losungen.json');
    const eintrag = daten?.[isoDatum(heute)];
    if (!eintrag || !eintrag.losung) return null;

    const stelle = String(eintrag.losung_stelle || '').trim();
    return {
      id: 'losung',
      typ: 'losung',
      rubrik: 'Losung',
      emoji: '⛪',
      text: kuerzen(eintrag.losung, 100) + (stelle ? ' · ' + stelle : ''),
      href: 'losung.html'
    };
  }


  function essensZieldatum(jetzt) {
    const tag = jetzt.getDay();
    if (tag === 0 || tag === 6) return null;

    const nachUmschaltzeit =
      jetzt.getHours() > 13 ||
      (jetzt.getHours() === 13 && jetzt.getMinutes() >= 15);

    /* Freitag nach 13:15 Uhr gibt es keinen Folgetag mit Mittagessen.
       Am Wochenende wird deshalb ebenfalls kein Essen-Tipp angeboten. */
    if (tag === 5 && nachUmschaltzeit) return null;

    const ziel = new Date(jetzt);
    if (nachUmschaltzeit) ziel.setDate(ziel.getDate() + 1);
    ziel.setHours(12, 0, 0, 0);

    return { ziel, istFolgetag: nachUmschaltzeit };
  }

  async function kandidatEssen(jetzt) {
    const zielInfo = essensZieldatum(jetzt);
    if (!zielInfo) return null;

    const daten = await ladeJson('data/speiseplan-kurz.json', true);
    const eintrag = daten?.tage?.[isoDatum(zielInfo.ziel)];
    const a1 = String(eintrag?.a1 || '').trim();
    const a2 = String(eintrag?.a2 || '').trim();

    /* Nur anzeigen, wenn beide ersten Menüs sicher erkannt wurden. */
    if (!a1 || !a2) return null;

    return {
      id: 'essen',
      typ: 'essen',
      rubrik: 'Mittagessen, zum Beispiel…',
      emoji: '🍽️',
      text: 'A1: ' + a1 + '\nA2: ' + a2,
      href: 'speiseplan.html'
    };
  }

  function datumTextIstHeute(text, heute) {
    const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(String(text || '').trim());
    if (!m) return false;
    return Number(m[1]) === heute.getDate() &&
           Number(m[2]) === heute.getMonth() + 1 &&
           Number(m[3]) === heute.getFullYear();
  }

  function wetterIstVonHeute(daten, heute) {
    return datumTextIstHeute(daten?.aktualisiert, heute);
  }

  function wetterStadtKurz(stadt, heute) {
    if (!stadt) return '';
    if (stadt.veraltet && !datumTextIstHeute(stadt.datenstand, heute)) return '';

    const ddmm = String(heute.getDate()).padStart(2, '0') + '.' +
                 String(heute.getMonth() + 1).padStart(2, '0') + '.';
    const tag = (stadt.tage || []).find(t => t.datum === ddmm) || (stadt.tage || [])[0];
    if (!tag) return '';

    /* In der kompakten Tageskarte zählt nur die Wetter-Aussage.
       Technische Abrufzeiten bleiben auf der ausführlichen Wetterseite. */
    return stadt.stadt + ': ' +
           (tag.emoji || '') + ' bis ' + tag.max + ' °C';
  }

  async function kandidatWetter(heute) {
    const daten = await ladeJson('data/wetter.json');
    if (!daten || !wetterIstVonHeute(daten, heute)) return null;

    const lu = (daten.staedte || []).find(s => s.stadt === 'Lüdenscheid');
    const bo = (daten.staedte || []).find(s => s.stadt === 'Bochum');
    const teile = [wetterStadtKurz(lu, heute), wetterStadtKurz(bo, heute)].filter(Boolean);
    if (!teile.length) return null;

    return {
      id: 'wetter',
      typ: 'wetter',
      rubrik: 'Wetter',
      emoji: '☀️',
      /* Jeder Ort beginnt bewusst in einer eigenen Zeile. */
      text: teile.join('\n'),
      href: 'wetter.html'
    };
  }

  function nachrichtenQuelleKey(n) {
    const direkt = String(n?.quelleKey || '').trim().toLowerCase();
    if (['leicht', 'tagesschau', 'kobinet'].includes(direkt)) return direkt;

    const quelle = String(n?.quelle || '').toLowerCase();
    if (quelle.includes('kobinet')) return 'kobinet';
    if (quelle.includes('tagesschau')) return 'tagesschau';
    return 'leicht';
  }

  function interneNachrichtenUrl(n, titel) {
    const params = new URLSearchParams();
    params.set('quelle', nachrichtenQuelleKey(n));

    const id = String(n?.id || '').trim();
    if (id) params.set('id', id);

    /* Titel bleibt als Rückwärtskompatibilitäts-Fallback erhalten. */
    params.set('titel', titel);

    return 'nachrichten-allgemein.html?' + params.toString();
  }

  function kandidatAdminNachricht(slot) {
    const n = slot && slot.nachricht;
    if (!n || !String(n.titel || n.title || '').trim()) return null;

    const titel = String(n.titel || n.title || '').trim();
    const quelle = String(n.quelle || '').trim();

    /* Manuell hervorgehobene Nachrichten bleiben auf der Studjo-Plattform.
       Der interne Link öffnet auf nachrichten-allgemein.html automatisch
       den passenden Anbieter-Tab und klappt genau diese Nachricht auf. */
    const href = interneNachrichtenUrl(n, titel);

    return {
      id: 'nachricht-' + String(n.id || hash(titel)).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80),
      typ: 'nachricht',
      rubrik: 'Wichtige Nachricht' + (quelle ? ' · ' + quelle : ''),
      emoji: String(n.emoji || '📰'),
      text: kuerzen(titel, 118),
      href,
      extern: false
    };
  }

  async function kandidatTerminUndBesonderes(heute) {
    if (!window.StudjoKalender) return { termin: null, besonderes: null };

    try {
      await window.StudjoKalender.datenBereit();
    } catch (e) {}

    const info = window.StudjoKalender.tagesInfo(heute);
    if (!info) return { termin: null, besonderes: null };

    // WICHTIG: info.ferien wird absichtlich vollständig ignoriert.
    let besonderes = null;
    if (info.primaer) {
      const p = info.primaer;
      besonderes = {
        id: 'besonderes',
        typ: 'besonderes',
        rubrik: p.art === 'feiertag' ? 'Feiertag' : 'Heute wichtig',
        emoji: p.art === 'schliessung' ? '🔒' : (p.art === 'brueckentag' ? '🌉' : '🎉'),
        text: p.titel + (p.details?.[0] ? ' · ' + p.details[0] : ''),
        href: 'termine.html'
      };
    }

    const termine = Array.isArray(info.termine) ? info.termine : [];
    let termin = null;
    if (termine.length) {
      const erster = termine[0];
      const zeit = (erster.details || []).find(d => /\d{1,2}:\d{2}/.test(d)) || '';
      const zusatz = termine.length > 1 ? termine.length + ' Termine heute · ' : '';
      const hinweis = (erster.details || []).find(d => d !== zeit && !/^Ansprechpartner:/i.test(d)) || '';

      termin = {
        id: 'termine',
        typ: 'termine',
        rubrik: 'Termin',
        emoji: erster.icon || '📅',
        text: zusatz + [erster.titel, zeit, hinweis].filter(Boolean).join(' · '),
        href: 'termine.html'
      };
    }

    return { termin, besonderes };
  }

  function istAusgeblendet(typ, vorgabe) {
    return Array.isArray(vorgabe?.ausblenden) && vorgabe.ausblenden.includes(typ);
  }

  function rendere(kandidaten) {
    const liste = $('tagesinfo-liste');
    if (!liste) return;
    liste.innerHTML = '';

    kandidaten.forEach(k => {
      const a = document.createElement('a');
      a.className = 'tagesinfo-item';
      a.href = k.href;
      if (k.extern) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      a.dataset.tagesinfoTyp = k.typ;
      a.setAttribute('aria-label', k.rubrik + ': ' + k.text + '. Mehr Informationen');
      a.innerHTML = `
        <span class="tagesinfo-emoji" aria-hidden="true">${k.emoji}</span>
        <span class="tagesinfo-inhalt" data-vorlesen>
          <span class="tagesinfo-rubrik">${k.rubrik}</span>
          <span class="tagesinfo-text">${k.text}</span>
        </span>
      `;
      liste.appendChild(a);
    });
  }

  async function tageskarteAktualisieren() {
    const grid = document.querySelector('.card-grid');
    if (!grid) return;

    injiziereStyles();
    const box = baueGrundgeruest(grid);

    if (aktualisierungLaeuft) {
      aktualisierungNochmal = true;
      return;
    }

    aktualisierungLaeuft = true;

    try {
      if (vorlesenAktiv) stoppVorlesen();

      const heute = new Date();
      heute.setHours(12, 0, 0, 0);

      const jetzt = new Date();

      const [admin, termindaten, aba, motto, losung, wetter, essen] = await Promise.all([
        ladeJson(ADMIN_DATEI, true),
        kandidatTerminUndBesonderes(heute),
        kandidatAba(heute),
        kandidatMotto(heute),
        kandidatLosung(heute),
        kandidatWetter(heute),
        kandidatEssen(jetzt)
      ]);

      planeTageskartenAktualisierung(admin, jetzt);

      /* Zeitsteuerung verwendet die echte aktuelle Uhrzeit. Für die inhaltlichen
         Tagesdaten bleibt "heute" auf 12 Uhr normalisiert. */
      const vorgabe = aktiveAdminVorgabe(admin, jetzt);
      const anzahl = Math.max(
        1,
        Math.min(3, Number(admin?.anzahl) || ANZAHL_STANDARD)
      );

      const alle = [
        termindaten.besonderes,
        termindaten.termin,
        aba,
        motto,
        losung,
        wetter,
        essen
      ].filter(Boolean);

      const map = new Map(alle.map(k => [k.typ, k]));
      const auswahl = [];

      function aufnehmen(kandidat, ausdruecklich = false) {
        if (!kandidat || auswahl.length >= anzahl) return false;
        if (auswahl.some(k => k.id === kandidat.id)) return false;
        if (
          !ausdruecklich &&
          istAusgeblendet(kandidat.typ, vorgabe) &&
          kandidat.typ !== 'besonderes'
        ) return false;

        auswahl.push(kandidat);
        return true;
      }

      // 1. Schließung/Feiertag/Brückentag ist unverdrängbar.
      aufnehmen(termindaten.besonderes, true);

      /* Automatische Reihenfolge für freie Plätze: echter Termin zuerst,
         montags danach das neue Motto, anschließend stabile Tagesmischung. */
      const autoReihe = [];

      function autoMerken(kandidat) {
        if (
          !kandidat ||
          kandidat.typ === 'besonderes' ||
          istAusgeblendet(kandidat.typ, vorgabe)
        ) return;

        if (!autoReihe.some(x => x.id === kandidat.id)) {
          autoReihe.push(kandidat);
        }
      }

      autoMerken(termindaten.termin);
      if (heute.getDay() === 1) autoMerken(motto);

      stabileSortierung(
        alle.filter(kandidat =>
          kandidat.typ !== 'besonderes' &&
          kandidat.typ !== 'termine' &&
          !(heute.getDay() === 1 && kandidat.typ === 'motto')
        ),
        heute,
        'tageskarte'
      ).forEach(autoMerken);

      let autoIndex = 0;

      function naechsterAutoKandidat() {
        while (autoIndex < autoReihe.length) {
          const kandidat = autoReihe[autoIndex++];
          if (!auswahl.some(x => x.id === kandidat.id)) return kandidat;
        }
        return null;
      }

      const plaetze = Array.isArray(vorgabe?.plaetze)
        ? vorgabe.plaetze.slice(0, 3)
        : null;

      if (plaetze && plaetze.length) {
        for (const slot of plaetze) {
          if (auswahl.length >= anzahl) break;

          const modus = String(slot?.modus || 'auto');
          let kandidat = null;
          let ausdruecklich = false;

          if (modus === 'auto') {
            kandidat = naechsterAutoKandidat();
          } else if (modus === 'nachricht') {
            kandidat = kandidatAdminNachricht(slot);
            ausdruecklich = true;
          } else {
            kandidat = map.get(modus) || null;
            ausdruecklich = true;
          }

          if (!aufnehmen(kandidat, ausdruecklich)) {
            aufnehmen(naechsterAutoKandidat(), false);
          }
        }

        while (auswahl.length < anzahl) {
          if (!aufnehmen(naechsterAutoKandidat(), false)) break;
        }

      } else {
        /* Rückwärtskompatibilität für ältere tagesinfo.json-Dateien. */
        (Array.isArray(vorgabe?.fixieren) ? vorgabe.fixieren : [])
          .forEach(typ => aufnehmen(map.get(typ), true));

        aufnehmen(termindaten.termin, false);
        if (heute.getDay() === 1) aufnehmen(motto, false);
        autoReihe.forEach(kandidat => aufnehmen(kandidat, false));
      }

      const status = $('tagesinfo-status');
      if (status) {
        status.textContent = '';
        status.hidden = true;
      }

      if (!auswahl.length) {
        box.hidden = true;
        return;
      }

      box.hidden = false;
      rendere(auswahl);

      if (vorgabe && status && vorgabe.hinweis) {
        status.textContent = vorgabe.hinweis;
        status.hidden = false;
      }

    } finally {
      aktualisierungLaeuft = false;

      if (aktualisierungNochmal) {
        aktualisierungNochmal = false;
        setTimeout(() => tageskarteAktualisieren(), 0);
      }
    }
  }

  function starten() {
    tageskarteAktualisieren();
  }

  window.addEventListener('pagehide', () => {
    stoppVorlesen();
    clearTimeout(tageskartenTimer);
  });

  /* Beim Zurückkehren in die PWA aktuelle Uhrzeit und Admin-Regeln prüfen.
     Das ist besonders für 13:15 Uhr und längere Hintergrundphasen wichtig. */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      tageskarteAktualisieren();
    }
  });

  window.addEventListener('pageshow', event => {
    if (event.persisted) tageskarteAktualisieren();
  });

  window.addEventListener('online', () => {
    tageskarteAktualisieren();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', starten, { once: true });
  } else {
    starten();
  }

})();
