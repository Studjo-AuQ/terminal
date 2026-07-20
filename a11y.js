/* ══════════════════════════════════════════════════════
   a11y.js – Barrierefreiheits-Steuerleiste
   Studjo Infoterminal | Evangelisches Johanneswerk

   Einbindung auf jeder Seite (kurz vor </body>):
     <link rel="stylesheet" href="a11y.css">
     <script src="a11y.js"></script>

   Voraussetzung für den Vorlesen-Button:
     Die Seite muss eine Funktion vorlesenUndMarkieren()
     definieren – fehlt sie, wird der Button ausgeblendet.
   ══════════════════════════════════════════════════════ */

(function () {

  /* ── 1. HTML der Steuerleiste in <body> einfügen ── */
  document.body.insertAdjacentHTML('beforeend', `
    <div class="a11y-bar" role="toolbar" aria-label="Barrierefreiheit">

      <button class="a11y-btn" id="btn-groesser"
              title="Schrift vergrößern"
              aria-label="Schrift vergrößern">A+</button>

      <button class="a11y-btn" id="btn-kleiner"
              title="Schrift verkleinern"
              aria-label="Schrift verkleinern">A−</button>

      <button class="a11y-btn" id="btn-kontrast"
              title="Kontrast umschalten"
              aria-label="Schwarz-Weiß-Kontrast umschalten">◑</button>

      <button class="a11y-btn" id="btn-vorlesen"
              title="Seite vorlesen"
              aria-label="Seite vorlesen">
        <img src="zuhoeren.jpg" alt="Vorlesen">
      </button>

    </div>

    <div class="a11y-toast" id="a11y-toast"></div>
  `);


  /* ── 2. Schriftgröße-Stufen ── */
  const STUFEN = [14, 16, 18, 20, 22, 24]; // px-Werte
  const STD    = 1;                          // Index 1 = 16 px (Standard)
  let stufe    = parseInt(localStorage.getItem('a11y-stufe') ?? STD);

  /* ── 3. Kontrast-Status ── */
  let kontrast = localStorage.getItem('a11y-kontrast') === '1';


  /* ── 4. Toast-Hinweis ── */
  let toastTimer = null;
  function zeigToast(text) {
    const t = document.getElementById('a11y-toast');
    t.textContent = text;
    t.classList.add('sichtbar');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('sichtbar'), 1800);
  }


  /* ── 5. Schriftgröße anwenden ── */
  function wendeSchriftAn(mitToast) {
    document.documentElement.style.fontSize = STUFEN[stufe] + 'px';
    localStorage.setItem('a11y-stufe', stufe);
    document.getElementById('btn-groesser').disabled = (stufe >= STUFEN.length - 1);
    document.getElementById('btn-kleiner').disabled  = (stufe <= 0);
    if (mitToast) zeigToast('Schrift: ' + STUFEN[stufe] + ' px');
  }

  /* ── 6. Kontrast anwenden ── */
  function wendeKontrastAn(mitToast) {
    document.body.classList.toggle('kontrast', kontrast);
    localStorage.setItem('a11y-kontrast', kontrast ? '1' : '0');
    const btn = document.getElementById('btn-kontrast');
    btn.classList.toggle('kontrast-aktiv', kontrast);
    btn.title = kontrast ? 'Kontrast: AN – Klicken zum Ausschalten'
                         : 'Kontrast umschalten';
    if (mitToast) zeigToast(kontrast ? 'Kontrast: AN' : 'Kontrast: AUS');
  }


  /* ── 7. Button-Klick-Events ── */
  document.getElementById('btn-groesser').addEventListener('click', function () {
    if (stufe < STUFEN.length - 1) { stufe++; wendeSchriftAn(true); }
  });

  document.getElementById('btn-kleiner').addEventListener('click', function () {
    if (stufe > 0) { stufe--; wendeSchriftAn(true); }
  });

  document.getElementById('btn-kontrast').addEventListener('click', function () {
    kontrast = !kontrast;
    wendeKontrastAn(true);
  });

  document.getElementById('btn-vorlesen').addEventListener('click', function () {
    if (typeof window.vorlesenUndMarkieren === 'function') {
      window.vorlesenUndMarkieren();
    }
  });


  /* ── 8. Vorlesen-Button nur anzeigen, wenn Funktion vorhanden ── */
  window.addEventListener('load', function () {
    if (typeof window.vorlesenUndMarkieren !== 'function') {
      document.getElementById('btn-vorlesen').style.display = 'none';
    }
  });


  /* ── 9. Beim Laden sofort anwenden (kein Toast) ── */
  wendeSchriftAn(false);
  wendeKontrastAn(false);

})();
