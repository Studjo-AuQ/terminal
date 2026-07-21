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

  /* ── 1. Seiteninhalt in Wrapper packen ──────────────────────────
     CSS-filter auf <body> bricht position:fixed → daher Wrapper.
     Die Buttonleiste bleibt direkt im <body>, außerhalb des Filters.
  ─────────────────────────────────────────────────────────────────── */
  const wrapper = document.createElement('div');
  wrapper.id = 'a11y-content-wrap';
  Array.from(document.body.childNodes).forEach(node => wrapper.appendChild(node));
  document.body.appendChild(wrapper);


  /* ── 2. HTML: Help-Button + versteckte Leiste + Toast ── */
  document.body.insertAdjacentHTML('beforeend', `

    <!-- Leiste (standardmäßig versteckt, öffnet sich beim Help-Klick) -->
    <div class="a11y-bar" id="a11y-bar" role="toolbar" aria-label="Barrierefreiheit">

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

    <!-- Help-Button: stets sichtbar rechts unten -->
    <button id="btn-help" title="Barrierefreiheit" aria-label="Bedienungshilfen öffnen"
            aria-expanded="false" aria-controls="a11y-bar">H</button>

    <div class="a11y-toast" id="a11y-toast"></div>
  `);


  /* ── 3. Leiste öffnen / schließen ── */
  let leistOffen = false;

  function leistToggle() {
    leistOffen = !leistOffen;
    document.getElementById('a11y-bar').classList.toggle('offen', leistOffen);
    const helpBtn = document.getElementById('btn-help');
    helpBtn.classList.toggle('offen', leistOffen);
    helpBtn.textContent  = leistOffen ? '✕' : 'H';
    helpBtn.title        = leistOffen ? 'Schließen' : 'Bedienungshilfen';
    helpBtn.setAttribute('aria-expanded', leistOffen);
  }

  function leistSchliessen() {
    if (!leistOffen) return;
    leistOffen = false;
    document.getElementById('a11y-bar').classList.remove('offen');
    const helpBtn = document.getElementById('btn-help');
    helpBtn.classList.remove('offen');
    helpBtn.textContent = 'H';
    helpBtn.title       = 'Bedienungshilfen';
    helpBtn.setAttribute('aria-expanded', false);
  }

  document.getElementById('btn-help').addEventListener('click', function (e) {
    e.stopPropagation();
    leistToggle();
  });

  /* Klick außerhalb schließt die Leiste */
  document.addEventListener('click', function (e) {
    const bar  = document.getElementById('a11y-bar');
    const help = document.getElementById('btn-help');
    if (leistOffen && !bar.contains(e.target) && e.target !== help) {
      leistSchliessen();
    }
  });


  /* ── 4. Schriftgröße-Stufen ── */
  const STUFEN = [14, 16, 18, 20, 22, 24];
  const STD    = 1;
  let stufe    = parseInt(localStorage.getItem('a11y-stufe') ?? STD);

  /* ── 5. Kontrast-Status ── */
  let kontrast = localStorage.getItem('a11y-kontrast') === '1';


  /* ── 6. Toast ── */
  let toastTimer = null;
  function zeigToast(text) {
    const t = document.getElementById('a11y-toast');
    t.textContent = text;
    t.classList.add('sichtbar');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('sichtbar'), 1800);
  }


  /* ── 7. Schriftgröße anwenden ── */
  function wendeSchriftAn(mitToast) {
    document.documentElement.style.fontSize = STUFEN[stufe] + 'px';
    localStorage.setItem('a11y-stufe', stufe);
    document.getElementById('btn-groesser').disabled = (stufe >= STUFEN.length - 1);
    document.getElementById('btn-kleiner').disabled  = (stufe <= 0);
    if (mitToast) zeigToast('Schrift: ' + STUFEN[stufe] + ' px');
  }

  /* ── 8. Kontrast anwenden (auf Wrapper, NICHT auf body!) ── */
  function wendeKontrastAn(mitToast) {
    document.getElementById('a11y-content-wrap').classList.toggle('kontrast', kontrast);
    localStorage.setItem('a11y-kontrast', kontrast ? '1' : '0');
    const btn = document.getElementById('btn-kontrast');
    btn.classList.toggle('kontrast-aktiv', kontrast);
    btn.title = kontrast ? 'Kontrast: AN – Klicken zum Ausschalten' : 'Kontrast umschalten';
    if (mitToast) zeigToast(kontrast ? 'Kontrast: AN' : 'Kontrast: AUS');
  }


  /* ── 9. Button-Klick-Events ── */
  document.getElementById('btn-groesser').addEventListener('click', function (e) {
    e.stopPropagation();
    if (stufe < STUFEN.length - 1) { stufe++; wendeSchriftAn(true); }
  });

  document.getElementById('btn-kleiner').addEventListener('click', function (e) {
    e.stopPropagation();
    if (stufe > 0) { stufe--; wendeSchriftAn(true); }
  });

  document.getElementById('btn-kontrast').addEventListener('click', function (e) {
    e.stopPropagation();
    kontrast = !kontrast;
    wendeKontrastAn(true);
  });

  document.getElementById('btn-vorlesen').addEventListener('click', function (e) {
    e.stopPropagation();
    if (typeof window.vorlesenUndMarkieren === 'function') {
      window.vorlesenUndMarkieren();
    }
  });


  /* ── 10. Vorlesen-Button nur anzeigen, wenn Funktion vorhanden ── */
  window.addEventListener('load', function () {
    if (typeof window.vorlesenUndMarkieren !== 'function') {
      document.getElementById('btn-vorlesen').style.display = 'none';
    }
  });


  /* ── 11. Beim Laden sofort anwenden (kein Toast) ── */
  wendeSchriftAn(false);
  wendeKontrastAn(false);

})();
