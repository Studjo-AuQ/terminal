/* ══════════════════════════════════════════════════════
   gong.js – Klingelzeichen für die Arbeitszeiten
   Studjo Infoterminal | Evangelisches Johanneswerk

   Einbindung auf jeder Seite (kurz vor </body>):
     <script src="gong.js"></script>

   Bewusst UNABHÄNGIG von a11y.js gehalten: a11y.js ist nicht
   auf jeder Seite eingebunden (manche Unterseiten haben eigene,
   angepasste Vorlesefunktionen; auf reinen iFrame-Seiten bringt
   a11y.js nichts). Der Gong soll aber überall funktionieren,
   daher eine eigene, schlanke Datei ohne Abhängigkeiten.

   Enthält zwei unabhängige Teile:
     1. Die Gong-Engine (Zeitplan, Ton abspielen, Freischaltung)
     2. Eine kleine Verbesserung für "← Zurück"-Buttons, damit
        der Browser die Seite beim Zurückgehen aus dem Bfcache
        wiederherstellen kann, statt sie komplett neu zu laden –
        das hält den bereits freigeschalteten Gong über die
        Navigation hinweg am Leben und erspart erneutes Antippen
        nach jeder Rückkehr zur Startseite.

   Die Uhrzeiten unten müssen mit der Zeitkachel in index.html
   synchron gehalten werden, falls sich die Arbeitszeiten mal
   ändern (bewusst getrennt gehalten, da unterschiedliche
   Zuständigkeit: Anzeige vs. Klingelzeichen).
   ══════════════════════════════════════════════════════ */

(function () {

  /* ════════════════════════════════════════════════════
     1. GONG-ENGINE
     Technik: Web Audio API (AudioContext) statt <audio>-Element
     – das ist der von Browsern (inkl. iOS Safari) empfohlene,
     robustere Weg für zeitgesteuerte Sounds. Die Datei wird
     sofort beim Laden geladen/dekodiert (braucht keine
     Interaktion, liefert sofort eine Fehlermeldung falls sie
     fehlt). Nur das "Loslegen" des AudioContext selbst
     (resume()) braucht eine Nutzer-Interaktion – die zählt bei
     JEDER Berührung der Seite, nicht nur bei einem bestimmten
     Button.
     ════════════════════════════════════════════════════ */
  const GONG_CFG = {
    WORK_START:  8 * 60,
    WORK_END_N:  15 * 60 + 15,
    WORK_END_K:  14 * 60 + 45,
    BREAK1_S:    10 * 60,
    BREAK1_E:    10 * 60 + 20,
    BREAK2_S:    12 * 60,
    BREAK2_E:    13 * 60,
  };

  function gongErsterDienstagDerMonats(d) {
    return d.getDay() === 2 && d.getDate() <= 7;
  }

  let gongAktiv = (localStorage.getItem('studjo-gong-aktiv') !== 'false'); // Standard: AN
  let gongAudioContext = null;
  let gongBuffer       = null;  // dekodierte Tondatei, sobald geladen
  let gongBereit       = false; // AudioContext läuft (nach erster Interaktion)
  let gongFehlerArt    = null;  // 'datei' | 'nicht_unterstuetzt' | null
  const gongHeuteAusgeloest = new Set();   // Schlüssel "Datum|Ereignis"
  const gongStatusListener  = [];          // Callbacks von Seiten mit eigenem Schalter (z. B. index.html)

  function gongStatus() {
    return { aktiv: gongAktiv, bereit: gongBereit, fehler: gongFehlerArt };
  }

  function gongStatusMelden() {
    const status = gongStatus();
    gongStatusListener.forEach(fn => {
      try { fn(status); } catch (e) { /* fehlerhafter Seiten-Callback stört den Gong selbst nicht */ }
    });
  }

  function gongHoleContext() {
    if (gongAudioContext) return gongAudioContext;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { gongFehlerArt = 'nicht_unterstuetzt'; return null; }
    gongAudioContext = new Ctx();
    return gongAudioContext;
  }

  function gongLadeDatei() {
    const ctx = gongHoleContext();
    if (!ctx) { gongStatusMelden(); return; }
    fetch('dingdong.mp3')
      .then(antwort => {
        if (!antwort.ok) throw new Error('HTTP ' + antwort.status);
        return antwort.arrayBuffer();
      })
      .then(daten => ctx.decodeAudioData(daten))
      .then(dekodiert => { gongBuffer = dekodiert; gongFehlerArt = null; gongStatusMelden(); })
      .catch(() => { gongFehlerArt = 'datei'; gongStatusMelden(); });
  }

  function gongVersucheFreischaltung() {
    const ctx = gongHoleContext();
    if (!ctx) return;
    if (ctx.state === 'running') {
      if (!gongBereit) { gongBereit = true; gongStatusMelden(); }
      return;
    }
    ctx.resume().then(() => {
      const neu = (ctx.state === 'running');
      if (neu !== gongBereit) { gongBereit = neu; gongStatusMelden(); }
    }).catch(() => { /* nächste Berührung versucht es erneut */ });
  }
  // Jede Berührung/jeder Klick irgendwo auf der Seite zählt –
  // nicht nur ein Tap auf einen bestimmten Button.
  ['touchstart', 'click', 'keydown'].forEach(ereignis =>
    document.addEventListener(ereignis, gongVersucheFreischaltung, { passive: true })
  );

  function gongSpiele(nochOft) {
    if (nochOft <= 0 || !gongAudioContext || !gongBuffer) return;
    const quelle = gongAudioContext.createBufferSource();
    quelle.buffer = gongBuffer;
    quelle.connect(gongAudioContext.destination);
    if (nochOft > 1) quelle.onended = () => setTimeout(() => gongSpiele(nochOft - 1), 300);
    quelle.start(0);
  }

  function gongWorkEnd(jetzt) {
    const kurzTag = jetzt.getDay() === 5 || gongErsterDienstagDerMonats(jetzt);
    return kurzTag ? GONG_CFG.WORK_END_K : GONG_CFG.WORK_END_N;
  }

  function gongPruefeZeit() {
    if (!gongAktiv || !gongAudioContext || gongAudioContext.state !== 'running') return;
    const jetzt = new Date();
    const tag   = jetzt.getDay();
    if (tag < 1 || tag > 5) return; // nur Mo–Fr
    const tm    = jetzt.getHours() * 60 + jetzt.getMinutes();
    const heute = jetzt.toDateString();
    const ereignisse = [
      ['arbeitsbeginn', GONG_CFG.WORK_START, 1],
      ['pause1-beginn', GONG_CFG.BREAK1_S,   1],
      ['pause1-ende',   GONG_CFG.BREAK1_E,   2],
      ['mittag-beginn', GONG_CFG.BREAK2_S,   1],
      ['mittag-ende',   GONG_CFG.BREAK2_E,   2],
      ['feierabend',    gongWorkEnd(jetzt),  2],
    ];
    for (const [name, minuten, mal] of ereignisse) {
      if (tm === minuten) {
        const schluessel = heute + '|' + name;
        if (!gongHeuteAusgeloest.has(schluessel)) {
          gongHeuteAusgeloest.add(schluessel);
          gongSpiele(mal);
        }
      }
    }
  }
  setInterval(gongPruefeZeit, 1000);

  /* Öffentliche Schnittstelle für Seiten mit eigenem Gong-Schalter
     (aktuell: die Glocke im Zeitkachel-Header auf index.html) */
  window.studjoGong = {
    istAktiv: () => gongAktiv,
    status:   gongStatus,
    umschalten: () => {
      gongAktiv = !gongAktiv;
      localStorage.setItem('studjo-gong-aktiv', String(gongAktiv));
      gongVersucheFreischaltung(); // Umschalten zählt selbst als Interaktion
      gongStatusMelden();
      return gongAktiv;
    },
    /* fn wird sofort einmal mit dem aktuellen Status aufgerufen und
       danach bei jeder Änderung erneut. */
    aufStatusAenderung: (fn) => {
      gongStatusListener.push(fn);
      fn(gongStatus());
    },
  };

  gongLadeDatei();


  /* ════════════════════════════════════════════════════
     2. VERBESSERTE "ZURÜCK"-NAVIGATION
     Wandelt alle Links mit class="back-button" von einer
     normalen (immer Neuladen erzwingenden) Navigation in eine
     echte Browser-Zurück-Navigation um. Der Browser kann die
     vorherige Seite dann aus dem Bfcache wiederherstellen,
     statt sie komplett neu zu laden – u. a. bleibt dadurch ein
     bereits freigeschalteter Gong über die Navigation hinweg
     erhalten.
     Fällt automatisch auf den normalen Link zurück, wenn es
     keine vorherige Seite in der Chronik gibt (z. B. Seite
     direkt über ein Lesezeichen geöffnet) – das Linkziel
     (href) bleibt dafür unverändert bestehen. */
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a.back-button').forEach(link => {
      link.addEventListener('click', (e) => {
        if (window.history.length > 1) {
          e.preventDefault();
          window.history.back();
        }
        // sonst: normaler Link-Klick zum href-Ziel
      });
    });
  });


  /* ════════════════════════════════════════════════════
     3. "STARTSEITE"-LINK IM FOOTER
     Anders als der "← Zurück"-Button ("eine Seite zurück")
     bedeutet "Startseite": "egal wie tief ich navigiert bin,
     bring mich direkt zu index.html". Ein einfaches
     history.back() wäre dafür nur zufällig richtig, wenn man
     genau eine Ebene tief ist. Stattdessen merkt sich jede
     Seite beim Laden ihre eigene Navigationstiefe (wie viele
     Klicks von der Startseite entfernt) in sessionStorage –
     so weiß der Footer-Link immer, wie viele Schritte er per
     history.go() zurückgehen muss, und bleibt dabei genauso
     Bfcache-freundlich wie der Zurück-Button. */
  let navTiefe = 1; // sicherer Standardwert, falls sessionStorage nicht verfügbar ist
  try {
    const dateiname = (location.pathname.split('/').pop() || 'index.html');
    if (dateiname === 'index.html' || dateiname === '') {
      navTiefe = 0;
    } else {
      const vomEigenenUrsprung = document.referrer && document.referrer.indexOf(location.origin) === 0;
      const vorherigeTiefe = parseInt(sessionStorage.getItem('studjo-nav-tiefe'), 10);
      navTiefe = (vomEigenenUrsprung && !isNaN(vorherigeTiefe)) ? vorherigeTiefe + 1 : 1;
    }
    sessionStorage.setItem('studjo-nav-tiefe', String(navTiefe));
  } catch (e) { /* sessionStorage evtl. blockiert – sicherer Standardwert bleibt bestehen */ }

  /* Wichtiger Zusatz gegen einen sonst schleichenden Fehler: Wird eine
     Seite per "← Zurück" aus dem Bfcache wiederhergestellt, läuft der
     obige Code NICHT erneut (kein Skript-Neustart bei Bfcache-
     Wiederherstellung) – die zuvor von einer TIEFEREN Unterseite
     gesetzte, mittlerweile veraltete Tiefe würde in sessionStorage
     "kleben bleiben". Landet man dann erneut auf dieser Unterseite,
     würde auf dieser veralteten (zu hohen) Tiefe aufgebaut und der
     "Startseite"-Link am Ende zu viele Schritte zurückgehen wollen –
     das ließ den Sicherheits-Check fehlschlagen und den Link auf eine
     normale, volle Neuladung zurückfallen (Gong wird zurückgesetzt).
     "pageshow" feuert sowohl beim ersten Laden als auch bei jeder
     Bfcache-Wiederherstellung dieser Seite – wir tragen die für DIESE
     Seite korrekte, bereits oben ermittelte Tiefe dann jedes Mal neu
     ein und überschreiben damit zuverlässig jeden veralteten Wert. */
  window.addEventListener('pageshow', () => {
    try { sessionStorage.setItem('studjo-nav-tiefe', String(navTiefe)); } catch (e) { /* siehe oben */ }
  });

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('footer a[href="index.html"]').forEach(link => {
      link.addEventListener('click', (e) => {
        if (navTiefe <= 0) { e.preventDefault(); return; } // schon auf der Startseite
        if (window.history.length > navTiefe) {
          e.preventDefault();
          window.history.go(-navTiefe);
        }
        // sonst: normaler Link-Klick zum href-Ziel (z. B. Seite direkt
        // per Lesezeichen geöffnet, keine ausreichende Chronik)
      });
    });
  });

})();
