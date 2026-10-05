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

   Enthält drei unabhängige Teile:
     1. Die Gong-Engine (Zeitplan, Ton abspielen, Freischaltung)
     2. Eine kleine Verbesserung für "← Zurück"-Buttons, damit
        der Browser die Seite beim Zurückgehen aus dem Bfcache
        wiederherstellen kann, statt sie komplett neu zu laden –
        das hält den bereits freigeschalteten Gong über die
        Navigation hinweg am Leben und erspart erneutes Antippen
        nach jeder Rückkehr zur Startseite.
     3. Die Anmeldung des Service Workers (sw.js) für Offline-
        Fähigkeit und Installierbarkeit (PWA) – läuft dadurch
        automatisch auf jeder Seite mit, ohne dass jede Seite
        selbst eine eigene Registrierung bräuchte.

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
     2. VERBESSERTE NAVIGATION ZU INDEX.HTML
     Gilt für den "← Zurück"-Button (class="back-button") UND
     den "Startseite"-Link im Footer (class="footer-home-link").
     Wandelt eine normale (immer Neuladen erzwingende)
     Navigation in eine echte Browser-Zurück-Navigation um. Der
     Browser kann die vorherige Seite dann aus dem Bfcache
     wiederherstellen, statt sie komplett neu zu laden – u. a.
     bleibt dadurch ein bereits freigeschalteter Gong über die
     Navigation hinweg erhalten.

     Ein früherer Versuch berechnete für den Footer-Link separat
     eine "Navigationstiefe" (über sessionStorage/referrer), um
     auch bei verschachtelten Seiten die richtige Anzahl Schritte
     zurückzugehen. Das hat sich als zu fehleranfällig erwiesen
     (schwer über mehrere Seitenaufrufe hinweg korrekt zu halten)
     und brachte keinen echten Vorteil: Auf dieser Seite zeigen
     sowohl der Zurück-Button als auch der Startseite-Link überall
     direkt auf index.html, also genau eine Ebene – daher reicht
     exakt derselbe einfache history.back()-Aufruf für beide, der
     beim Zurück-Button bereits nachweislich funktioniert. Sollte
     später eine tiefer verschachtelte Seite mit Startseite-Link
     hinzukommen, müsste das hier erneut betrachtet werden.

     Fällt automatisch auf den normalen Link zurück, wenn es keine
     vorherige Seite in der Chronik gibt (z. B. Seite direkt über
     ein Lesezeichen geöffnet) – das Linkziel (href) bleibt dafür
     unverändert bestehen. */
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a.back-button, a.footer-home-link').forEach(link => {
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
     4. SERVICE-WORKER-REGISTRIERUNG (Offline/PWA)
     Macht die Seite installierbar und lässt bereits besuchte
     Seiten auch ohne Internet weiter funktionieren (sw.js
     übernimmt die eigentliche Caching-Strategie).

     Update-Verhalten bewusst automatisch statt mit einer
     "Update verfügbar"-Schaltfläche: Die Zielgruppe soll sich
     um nichts kümmern müssen. Sobald eine neue Version von
     sw.js aktiv wird (z. B. weil Marc etwas aktualisiert hat
     und das Gerät kurz online war), lädt die gerade offene
     Seite sich EINMALIG automatisch neu, damit sie die neue
     Version zeigt – ganz ohne Zutun der Werkstattbeschäftigten. */
  if ('serviceWorker' in navigator) {
    /* updateViaCache:'none' zwingt den Browser, bei der Prüfung auf
       eine neue sw.js-Version IMMER tatsächlich im Netz nachzusehen,
       statt möglicherweise eine ältere, zwischengespeicherte Version
       aus dem normalen HTTP-Cache zu verwenden. Ohne das kann es
       passieren, dass Aktualisierungen an sw.js auf einem Gerät, das
       schon einmal einen Service Worker registriert hat, faktisch
       gar nicht ankommen. */
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((registrierung) => {
      console.log('[Studjo] Service Worker registriert, Geltungsbereich:', registrierung.scope);
      if (navigator.serviceWorker.controller) versucheVorladen();

      /* Regelmäßig aktiv nach einer neueren sw.js suchen. Normalerweise
         prüft der Browser das bei jeder Seitennavigation von selbst –
         index.html hat aber (anders als z. B. wetter.html) keinen
         eigenen Automatik-Reload, könnte auf einem Kiosk also
         stundenlang offen bleiben, ohne dass diese Prüfung von selbst
         passiert. */
      setInterval(() => { registrierung.update().catch(() => {}); }, 60 * 60 * 1000); // stündlich
    }).catch((fehler) => {
      /* Offline beim allerersten Besuch oder Registrierung aus
         anderem Grund nicht möglich – die Seite funktioniert dann
         einfach ganz normal online weiter, nur ohne Offline-Vorteil.
         Zur Fehlersuche trotzdem sichtbar protokollieren (in der
         Browser-Konsole, F12), statt es völlig stillschweigend zu
         verschlucken. */
      console.error('[Studjo] Service-Worker-Registrierung fehlgeschlagen:', fehler);
    });

    let schonNeuGeladen = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[Studjo] Ein (neuer) Service Worker hat gerade die Kontrolle übernommen.');
      versucheVorladen(); // gilt auch für den allerersten Besuch (siehe unten)
      if (schonNeuGeladen) return;
      schonNeuGeladen = true;
      window.location.reload();
    });
  }


  /* ════════════════════════════════════════════════════
     5. UNTERSEITEN IM HINTERGRUND VORLADEN (nur von der
     Startseite aus)
     Grund: Ohne das zeigt der Browser bei einer Unterseite, die
     noch nie einzeln besucht wurde, im Offline-Fall seine eigene,
     unschöne Standard-Fehlerseite statt offline.html – der
     Service Worker kann ja nur zeigen, was er schon kennt.

     Statt dafür eine Liste aller Seiten von Hand zu pflegen
     (die bei jeder neuen Unterseite veralten würde), liest diese
     Funktion die Links direkt aus der Startseite selbst aus und
     folgt ihnen dann rekursiv ein paar Ebenen tief – so werden
     praktisch alle über Links erreichbaren Seiten automatisch
     gefunden, auch künftig neu hinzugefügte, ganz ohne dass hier
     je etwas von Hand ergänzt werden müsste.

     Jeder fetch() läuft dabei ganz normal über den Service Worker
     und landet dadurch von selbst im Cache – es ist also keine
     eigene Lade-Logik im Service Worker nötig.

     Höchstens einmal pro Tag (lokal gemerkt), damit nicht bei
     jedem Start der Startseite unnötig 30+ Seiten neu geladen
     werden. */
  const VORLADEN_SCHLUESSEL = 'studjo-vorladen-zeitpunkt';
  const VORLADEN_ABSTAND_MS = 24 * 60 * 60 * 1000; // 1 Tag

  async function versucheVorladen() {
    const dateiname = (location.pathname.split('/').pop() || 'index.html');
    if (dateiname !== 'index.html' && dateiname !== '') return; // nur von der Startseite anstoßen

    try {
      const zuletzt = parseInt(localStorage.getItem(VORLADEN_SCHLUESSEL), 10);
      if (!isNaN(zuletzt) && (Date.now() - zuletzt) < VORLADEN_ABSTAND_MS) return;
      localStorage.setItem(VORLADEN_SCHLUESSEL, String(Date.now()));
    } catch (e) { /* localStorage evtl. blockiert - dann halt jedes Mal vorladen, nicht schlimm */ }

    const besucht = new Set();
    const warteschlange = eigenePfadeAufSeite(document);
    const MAX_SEITEN = 60; // Sicherheitsgrenze, damit sich nichts aufschaukeln kann

    while (warteschlange.length && besucht.size < MAX_SEITEN) {
      const pfad = warteschlange.shift();
      if (besucht.has(pfad)) continue;
      besucht.add(pfad);
      try {
        const antwort = await fetch(pfad);
        if (!antwort.ok) continue;
        const text = await antwort.text();
        const doc = new DOMParser().parseFromString(text, 'text/html');
        eigenePfadeAufSeite(doc).forEach(p => { if (!besucht.has(p)) warteschlange.push(p); });
      } catch (e) {
        /* einzelne Seite nicht erreichbar/fehlerhaft - Rest der
           Liste trotzdem weiter abarbeiten */
      }
    }
  }

  function eigenePfadeAufSeite(doc) {
    const pfade = new Set();
    doc.querySelectorAll('a[href$=".html"]').forEach((a) => {
      const href = a.getAttribute('href');
      if (href && !href.includes('://') && !href.startsWith('//')) pfade.add(href);
    });
    return [...pfade];
  }

})();
