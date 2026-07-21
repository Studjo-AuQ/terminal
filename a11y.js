/* ══════════════════════════════════════════════════════
   a11y.js – Barrierefreiheits-Steuerleiste
   Studjo Infoterminal | Evangelisches Johanneswerk

   Einbindung auf jeder Seite (kurz vor </body>):
     <link rel="stylesheet" href="a11y.css">
     <script src="a11y.js"></script>

   Aus den HTML-Seiten kannst du danach entfernen:
     • <div class="read-aloud-container">…</div>
     • CSS: .read-aloud-container, .btn-read-aloud, .is-reading
     • JS: vorlesenUndMarkieren(), spieleSequenz(),
           entferneAlleMarkierungen(), isSpeaking, aktuelleAussage

   Seiten mit eigener vorlesenUndMarkieren()-Funktion:
     Diese wird weiterhin verwendet – a11y.js fällt nur dann
     auf die generische Funktion zurück, wenn keine eigene
     definiert ist. Du kannst die seitenspezifische Funktion
     also schrittweise durch die generische ersetzen.
   ══════════════════════════════════════════════════════ */

(function () {

  /* ════════════════════════════════════════════════════
     1. SEITENINHALT IN WRAPPER PACKEN
     CSS-filter auf <body> bricht position:fixed.
     Wrapper bekommt den Filter – Buttonleiste bleibt außen.
     ════════════════════════════════════════════════════ */
  const wrapper = document.createElement('div');
  wrapper.id = 'a11y-content-wrap';
  Array.from(document.body.childNodes).forEach(node => wrapper.appendChild(node));
  document.body.appendChild(wrapper);


  /* ════════════════════════════════════════════════════
     2. HTML EINFÜGEN
     ════════════════════════════════════════════════════ */
  document.body.insertAdjacentHTML('beforeend', `

    <div class="a11y-bar" id="a11y-bar" role="toolbar" aria-label="Barrierefreiheit">

      <button class="a11y-btn" id="btn-groesser"
              title="Schrift vergrößern" aria-label="Schrift vergrößern">A+</button>

      <button class="a11y-btn" id="btn-kleiner"
              title="Schrift verkleinern" aria-label="Schrift verkleinern">A−</button>

      <button class="a11y-btn" id="btn-kontrast"
              title="Kontrast umschalten"
              aria-label="Schwarz-Weiß-Kontrast umschalten">◑</button>

      <button class="a11y-btn" id="btn-vorlesen"
              title="Seite vorlesen" aria-label="Seite vorlesen">
        <img src="zuhoeren.jpg" alt="Vorlesen">
      </button>

    </div>

    <button id="btn-help" title="Bedienungshilfen"
            aria-label="Bedienungshilfen öffnen"
            aria-expanded="false" aria-controls="a11y-bar">H</button>

    <div class="a11y-toast" id="a11y-toast"></div>
  `);


  /* ════════════════════════════════════════════════════
     3. LEISTE ÖFFnen / SCHLIESSen
     ════════════════════════════════════════════════════ */
  let leistOffen = false;

  function leistToggle() {
    leistOffen = !leistOffen;
    document.getElementById('a11y-bar').classList.toggle('offen', leistOffen);
    const h = document.getElementById('btn-help');
    h.classList.toggle('offen', leistOffen);
    h.textContent = leistOffen ? '✕' : 'H';
    h.title       = leistOffen ? 'Schließen' : 'Bedienungshilfen';
    h.setAttribute('aria-expanded', leistOffen);
  }

  function leistSchliessen() {
    if (!leistOffen) return;
    leistOffen = false;
    document.getElementById('a11y-bar').classList.remove('offen');
    const h = document.getElementById('btn-help');
    h.classList.remove('offen');
    h.textContent = 'H';
    h.title       = 'Bedienungshilfen';
    h.setAttribute('aria-expanded', false);
  }

  document.getElementById('btn-help').addEventListener('click', function (e) {
    e.stopPropagation();
    leistToggle();
  });

  document.addEventListener('click', function (e) {
    const bar  = document.getElementById('a11y-bar');
    const help = document.getElementById('btn-help');
    if (leistOffen && !bar.contains(e.target) && e.target !== help) {
      leistSchliessen();
    }
  });


  /* ════════════════════════════════════════════════════
     4. SCHRIFTGRÖSSE
     ════════════════════════════════════════════════════ */
  const STUFEN = [14, 16, 18, 20, 22, 24];
  const STD    = 1;
  let stufe    = parseInt(localStorage.getItem('a11y-stufe') ?? STD);

  function wendeSchriftAn(mitToast) {
    document.documentElement.style.fontSize = STUFEN[stufe] + 'px';
    localStorage.setItem('a11y-stufe', stufe);
    document.getElementById('btn-groesser').disabled = (stufe >= STUFEN.length - 1);
    document.getElementById('btn-kleiner').disabled  = (stufe <= 0);
    if (mitToast) zeigToast('Schrift: ' + STUFEN[stufe] + ' px');
  }

  document.getElementById('btn-groesser').addEventListener('click', function (e) {
    e.stopPropagation();
    if (stufe < STUFEN.length - 1) { stufe++; wendeSchriftAn(true); }
  });

  document.getElementById('btn-kleiner').addEventListener('click', function (e) {
    e.stopPropagation();
    if (stufe > 0) { stufe--; wendeSchriftAn(true); }
  });


  /* ════════════════════════════════════════════════════
     5. KONTRAST (Filter auf Wrapper, nicht body)
     ════════════════════════════════════════════════════ */
  let kontrast = localStorage.getItem('a11y-kontrast') === '1';

  function wendeKontrastAn(mitToast) {
    document.getElementById('a11y-content-wrap').classList.toggle('kontrast', kontrast);
    localStorage.setItem('a11y-kontrast', kontrast ? '1' : '0');
    const btn = document.getElementById('btn-kontrast');
    btn.classList.toggle('kontrast-aktiv', kontrast);
    btn.title = kontrast ? 'Kontrast AN – zum Ausschalten klicken' : 'Kontrast umschalten';
    if (mitToast) zeigToast(kontrast ? 'Kontrast: AN' : 'Kontrast: AUS');
  }

  document.getElementById('btn-kontrast').addEventListener('click', function (e) {
    e.stopPropagation();
    kontrast = !kontrast;
    wendeKontrastAn(true);
  });


  /* ════════════════════════════════════════════════════
     6. VORLESEN – generische Implementierung
        Liest alle sichtbaren Textelemente aus <main>.
        Funktioniert auf jeder Seite ohne zusätzlichen Code.
        Seiten mit eigener vorlesenUndMarkieren()-Funktion
        können diese weiterhin behalten – sie hat Vorrang.
     ════════════════════════════════════════════════════ */

  let isSpeaking      = false;
  let aktuelleAussage = null;

  /* Elemente, die generisch vorgelesen werden */
  const LESE_SELEKTOREN = [
    'h1', 'h2', 'h3',
    'p',
    'li',
    '.news-title', '.news-text',          /* nachrichten*.html  */
    '.kachel-titel', '.faq-frage-text',   /* faq.html           */
    '.antwort-text',
    '.termin-titel', '.termin-info',      /* termine.html o.ä.  */
    '[data-vorlesen]'                     /* beliebige Seite    */
  ].join(', ');

  /* Elemente überspringen, die in diesen Containern stecken */
  const SKIP_SELEKTOREN = '.a11y-bar, #btn-help, footer, nav, .quiz-box, button, script, style';

  function vorlesenGenerisch() {
    if (isSpeaking || window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      entferneAlleMarkierungen();
      isSpeaking = false;
      document.getElementById('btn-vorlesen').classList.remove('aktiv');
      return;
    }

    window.speechSynthesis.cancel();
    isSpeaking = true;
    document.getElementById('btn-vorlesen').classList.add('aktiv');

    const container = document.querySelector('main') || document.body;
    const kandidaten = Array.from(container.querySelectorAll(LESE_SELEKTOREN));

    const elemente = kandidaten
      .filter(el => !el.closest(SKIP_SELEKTOREN))   // Skipzonen ausschließen
      .filter(el => el.offsetParent !== null)        // nur sichtbare
      .filter(el => (el.innerText || '').trim().length > 2)
      .map(el => ({
        text:    el.innerText.trim().replace(/\s+/g, ' '),
        element: el
      }));

    if (elemente.length === 0) {
      isSpeaking = false;
      document.getElementById('btn-vorlesen').classList.remove('aktiv');
      zeigToast('Kein Text zum Vorlesen gefunden.');
      return;
    }

    spieleSequenz(elemente, 0);
  }

  function spieleSequenz(elemente, index) {
    if (index >= elemente.length || !isSpeaking) {
      entferneAlleMarkierungen();
      isSpeaking = false;
      document.getElementById('btn-vorlesen').classList.remove('aktiv');
      return;
    }
    const abschnitt   = elemente[index];
    aktuelleAussage   = new SpeechSynthesisUtterance(abschnitt.text);
    aktuelleAussage.lang = 'de-DE';
    aktuelleAussage.rate = 0.88;

    aktuelleAussage.onstart = () => {
      entferneAlleMarkierungen();
      if (abschnitt.element) abschnitt.element.classList.add('is-reading');
    };
    aktuelleAussage.onend = () => {
      setTimeout(() => spieleSequenz(elemente, index + 1), 300);
    };
    aktuelleAussage.onerror = () => {
      entferneAlleMarkierungen();
      isSpeaking = false;
      document.getElementById('btn-vorlesen').classList.remove('aktiv');
    };
    window.speechSynthesis.speak(aktuelleAussage);
  }

  function entferneAlleMarkierungen() {
    document.querySelectorAll('.is-reading')
      .forEach(el => el.classList.remove('is-reading'));
  }

  /* Öffentlich zugänglich (für Seiten, die explizit aufrufen wollen) */
  window.a11yVorlesen            = vorlesenGenerisch;
  window.a11ySpielSequenz        = spieleSequenz;
  window.a11yEntferneMarkierungen = entferneAlleMarkierungen;

  /* Vorlesen-Button: eigene Seitenfunktion hat Vorrang */
  document.getElementById('btn-vorlesen').addEventListener('click', function (e) {
    e.stopPropagation();
    if (typeof window.vorlesenUndMarkieren === 'function') {
      window.vorlesenUndMarkieren();   /* seitenspezifisch */
    } else {
      vorlesenGenerisch();             /* generisch        */
    }
  });


  /* ════════════════════════════════════════════════════
     7. TOAST
     ════════════════════════════════════════════════════ */
  let toastTimer = null;
  function zeigToast(text) {
    const t = document.getElementById('a11y-toast');
    t.textContent = text;
    t.classList.add('sichtbar');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('sichtbar'), 1800);
  }


  /* ════════════════════════════════════════════════════
     8. BEIM LADEN SOFORT ANWENDEN (kein Toast)
     ════════════════════════════════════════════════════ */
  wendeSchriftAn(false);
  wendeKontrastAn(false);

})();
