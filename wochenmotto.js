/* ══════════════════════════════════════════════════════
   wochenmotto.js
   Studjo Terminal | Evangelisches Johanneswerk

   Berechnet die aktuelle ISO-8601-Kalenderwoche, lädt die
   passenden Inhalte aus wochenmottos.json und zeigt sie an.
   Es gibt 50 Mottos. Ab KW 51 beginnt die Zählung wieder
   bei Motto 1 (zyklisch), Jahreswechsel ist eingerechnet.

   Test-Modus (für Bildschirme/Prüfungen, für normale
   Nutzer unsichtbar): an die URL ?kw=10 anhängen, um
   testweise das Motto der Woche 10 zu sehen, z. B.:
   wochenmotto.html?kw=10
   ══════════════════════════════════════════════════════ */

(function () {

  const JSON_DATEI = 'wochenmottos.json';
  const ANZAHL_MOTTOS = 50;

  /* ── ISO-8601-Kalenderwoche berechnen ──
     Standardverfahren: auf den Donnerstag der Woche
     springen, dann mit dem ersten Donnerstag des Jahres
     vergleichen. Funktioniert korrekt über Jahreswechsel
     hinweg (auch bei KW 52/53). */
  function getISOWeek(datum) {
    const d = new Date(Date.UTC(
      datum.getFullYear(), datum.getMonth(), datum.getDate()
    ));
    // Montag = 0 ... Sonntag = 6
    const wochentag = (d.getUTCDay() + 6) % 7;
    // auf den Donnerstag dieser Woche springen
    d.setUTCDate(d.getUTCDate() - wochentag + 3);

    // erster Donnerstag des Jahres
    const jahresStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const startWochentag = (jahresStart.getUTCDay() + 6) % 7;
    jahresStart.setUTCDate(jahresStart.getUTCDate() - startWochentag + 3);

    const wocheMs = 7 * 24 * 60 * 60 * 1000;
    return 1 + Math.round((d - jahresStart) / wocheMs);
  }

  /* ── Testparameter ?kw=NN auslesen ── */
  function getTestWoche() {
    const params = new URLSearchParams(window.location.search);
    const wert = parseInt(params.get('kw'), 10);
    if (!isNaN(wert) && wert >= 1) return wert;
    return null;
  }

  /* ── ISO-Kalenderwoche auf 1–50 abbilden (zyklisch) ── */
  function mottoNummerFuerWoche(isoWoche) {
    // (isoWoche - 1) % 50, dann wieder auf 1..50 verschieben
    return ((isoWoche - 1) % ANZAHL_MOTTOS) + 1;
  }

  /* ── Fehlermeldung anzeigen ── */
  function zeigeFehler() {
    const box = document.getElementById('wm-box');
    if (!box) return;
    box.innerHTML =
      '<p class="wm-fehler">Das Wochenmotto kann gerade nicht geladen werden.</p>';
  }

  /* ── Motto in die Seite einbauen ── */
  function zeigeMotto(eintrag, isoWoche) {
    const kwEl     = document.getElementById('wm-kw');
    const mottoEl  = document.getElementById('wm-motto');
    const toggleEl = document.getElementById('wm-toggle');
    const erklEl   = document.getElementById('wm-erklaerung');
    const listeEl  = document.getElementById('wm-erklaerung-liste');

    if (!eintrag) { zeigeFehler(); return; }

    kwEl.textContent = 'Diese Woche: KW ' + isoWoche;
    mottoEl.textContent = eintrag.motto;

    listeEl.innerHTML = '';
    eintrag.erklaerungen.forEach(function (satz) {
      const li = document.createElement('li');
      li.textContent = satz;
      listeEl.appendChild(li);
    });

    /* Aufklappen / Zuklappen per Klick oder Tastatur */
    toggleEl.addEventListener('click', function () {
      const offen = toggleEl.getAttribute('aria-expanded') === 'true';
      toggleEl.setAttribute('aria-expanded', String(!offen));
      erklEl.hidden = offen;
      toggleEl.querySelector('.wm-pfeil').textContent = offen ? '▼' : '▲';
    });
  }

  /* ── Start ── */
  document.addEventListener('DOMContentLoaded', function () {
    const testWoche = getTestWoche();
    const isoWoche  = testWoche !== null ? testWoche : getISOWeek(new Date());
    const mottoNr   = mottoNummerFuerWoche(isoWoche);

    fetch(JSON_DATEI)
      .then(function (antwort) {
        if (!antwort.ok) throw new Error('HTTP ' + antwort.status);
        return antwort.json();
      })
      .then(function (daten) {
        const eintrag = daten.wochenmottos.find(function (m) {
          return m.woche === mottoNr;
        });
        zeigeMotto(eintrag, isoWoche);
      })
      .catch(function (fehler) {
        console.error('Wochenmotto konnte nicht geladen werden:', fehler);
        zeigeFehler();
      });
  });

})();
