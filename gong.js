/* ══════════════════════════════════════════════════════
   gong.js – Klingelzeichen für die Arbeitszeiten
   Studjo Infoterminal | Evangelisches Johanneswerk

   Diese Datei enthält nur:
     1. Gong-Engine (Zeitplan, Ton, Freischaltung)
     2. Navigation zurück zur Startseite

   Die komplette Offline-/PWA-Logik liegt jetzt in offline.js.
   Weil gong.js bereits auf praktisch allen Terminal-Seiten eingebunden
   ist, lädt es offline.js lediglich als kleinen Bootstrap nach. Dadurch
   wird der Service Worker auch dann registriert, wenn eine Unterseite
   direkt geöffnet wird.

   Zusätzlich wird ui-a11y.js als zentrale Tastatur-/Dialog-Hilfe
   nachgeladen. Dadurch müssen die vielen vorhandenen HTML-Seiten
   nicht einzeln mit identischem Dialog-Code gepflegt werden.
   ══════════════════════════════════════════════════════ */

(function () {

  /* ════════════════════════════════════════════════════
     1. GONG-ENGINE
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

  let gongAktiv = (localStorage.getItem('studjo-gong-aktiv') !== 'false');
  let gongAudioContext = null;
  let gongBuffer       = null;
  let gongBereit       = false;
  let gongFehlerArt    = null;
  const gongHeuteAusgeloest = new Set();
  const gongStatusListener  = [];

  function gongStatus() {
    return { aktiv: gongAktiv, bereit: gongBereit, fehler: gongFehlerArt };
  }

  function gongSichtbarenButtonErklaeren() {
    const btn =
      document.getElementById(
        'zk-gong-btn'
      );

    if (!btn) return;

    if (
      gongAktiv &&
      !gongBereit &&
      !gongFehlerArt
    ) {
      btn.setAttribute(
        'aria-label',
        'Klingelzeichen aktivieren – Glocke einmal anklicken'
      );

      btn.title =
        'Klingelzeichen aktivieren – einmal anklicken';
    }
  }

  function gongStatusMelden() {
    const status = gongStatus();

    gongStatusListener.forEach(fn => {
      try { fn(status); } catch (e) {
        /* Ein fehlerhafter Seiten-Callback darf den Gong nicht stoppen. */
      }
    });

    /* Die Startseite setzt ihren sichtbaren Glocken-Status ebenfalls
       über einen Listener. Dieser kleine Nachlauf präzisiert bei
       gesperrtem Browser-Audio anschließend die Bedienhinweise. */
    window.setTimeout(
      gongSichtbarenButtonErklaeren,
      0
    );
  }

  function gongHoleContext() {
    if (gongAudioContext) return gongAudioContext;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      gongFehlerArt = 'nicht_unterstuetzt';
      return null;
    }
    gongAudioContext = new Ctx();
    return gongAudioContext;
  }

  function gongLadeDatei() {
    const ctx = gongHoleContext();
    if (!ctx) {
      gongStatusMelden();
      return;
    }

    fetch('dingdong.mp3')
      .then(antwort => {
        if (!antwort.ok) throw new Error('HTTP ' + antwort.status);
        return antwort.arrayBuffer();
      })
      .then(daten => ctx.decodeAudioData(daten))
      .then(dekodiert => {
        gongBuffer = dekodiert;
        gongFehlerArt = null;

        /* Sofort versuchen:
           Wenn der Browser / die Site-Berechtigung Autoplay bereits
           erlaubt, wird der Gong ohne zusätzlichen Klick bereit. */
        gongVersucheFreischaltung();

        gongStatusMelden();
      })
      .catch(() => {
        gongFehlerArt = 'datei';
        gongStatusMelden();
      });
  }

  function gongVersucheFreischaltung() {
    const ctx = gongHoleContext();
    if (!ctx) return;

    if (ctx.state === 'running') {
      if (!gongBereit) {
        gongBereit = true;
        gongStatusMelden();
      }
      return;
    }

    ctx.resume()
      .then(() => {
        const neu = (ctx.state === 'running');
        if (neu !== gongBereit) {
          gongBereit = neu;
          gongStatusMelden();
        }
      })
      .catch(() => {
        /* Die nächste Nutzer-Interaktion versucht es erneut. */
      });
  }

  ['touchstart', 'click', 'keydown'].forEach(ereignis =>
    document.addEventListener(ereignis, gongVersucheFreischaltung, { passive: true })
  );

  function gongSpiele(nochOft) {
    if (nochOft <= 0 || !gongAudioContext || !gongBuffer) return;

    const quelle = gongAudioContext.createBufferSource();
    quelle.buffer = gongBuffer;
    quelle.connect(gongAudioContext.destination);

    if (nochOft > 1) {
      quelle.onended = () => setTimeout(() => gongSpiele(nochOft - 1), 300);
    }
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
    if (tag < 1 || tag > 5) return;

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

  window.studjoGong = {
    istAktiv: () => gongAktiv,
    status:   gongStatus,

    umschalten: () => {
      /* Wichtig für die Bedienung:
         Wenn der Gong eingeschaltet, aber vom Browser noch gesperrt ist,
         bedeutet der erste Glocken-Klick „Ton freischalten“ und NICHT
         „Gong ausschalten“. */
      if (
        gongAktiv &&
        !gongBereit &&
        !gongFehlerArt
      ) {
        gongVersucheFreischaltung();
        gongStatusMelden();
        return true;
      }

      gongAktiv = !gongAktiv;

      localStorage.setItem(
        'studjo-gong-aktiv',
        String(gongAktiv)
      );

      if (gongAktiv) {
        gongVersucheFreischaltung();
      }

      gongStatusMelden();
      return gongAktiv;
    },

    aktivieren: () => {
      gongAktiv = true;

      localStorage.setItem(
        'studjo-gong-aktiv',
        'true'
      );

      gongVersucheFreischaltung();
      gongStatusMelden();
      return true;
    },

    aufStatusAenderung: (fn) => {
      gongStatusListener.push(fn);
      fn(gongStatus());

      window.setTimeout(
        gongSichtbarenButtonErklaeren,
        0
      );
    },
  };

  gongLadeDatei();

  /* Schon beim Seitenaufruf einmal versuchen.
     Das ist erlaubt, wenn der Browser für diese Site Autoplay bereits
     freigegeben hat. Bei gesperrtem Autoplay passiert nichts Schädliches;
     die nächste echte Nutzeraktion versucht es erneut. */
  gongVersucheFreischaltung();

  document.addEventListener(
    'DOMContentLoaded',
    () => {
      window.setTimeout(
        gongSichtbarenButtonErklaeren,
        0
      );
    },
    { once: true }
  );


  /* ════════════════════════════════════════════════════
     2. NAVIGATION ZURÜCK ZUR STARTSEITE
     Bestehendes Verhalten bleibt erhalten.
     ════════════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', () => {
    /* Dateiname-Migration:
       Die frühere interne Seite nachrichten.html heißt nun eindeutig
       neuigkeiten.html. So funktioniert die Startseiten-Kachel auch,
       wenn die alte nachrichten.html gelöscht wurde. */
    document.querySelectorAll('a[href="nachrichten.html"]').forEach(link => {
      link.setAttribute('href', 'neuigkeiten.html');
    });

    document.querySelectorAll('a.back-button, a.footer-home-link').forEach(link => {
      link.addEventListener('click', (e) => {
        if (window.history.length > 1) {
          e.preventDefault();
          window.history.back();
        }
      });
    });
  });

})();


/* ══════════════════════════════════════════════════════
   OFFLINE-MODUL LADEN
   ══════════════════════════════════════════════════════ */
(function ladeStudjoOfflineModul() {
  if (!('serviceWorker' in navigator)) return;
  if (document.querySelector('script[data-studjo-offline]')) return;

  const script = document.createElement('script');
  script.src = 'offline.js';
  script.async = true;
  script.dataset.studjoOffline = 'true';
  script.onerror = () => {
    console.warn('[Studjo] offline.js konnte nicht geladen werden.');
  };
  document.head.appendChild(script);
})();


/* ══════════════════════════════════════════════════════
   UI-BARRIEREFREIHEIT LADEN
   ui-a11y.js ergänzt vorhandene Popups und Aufklappbereiche
   zentral um Tastaturbedienung, Fokusführung und ARIA.
   Außerdem zeigt es vor internen ConSense-Links einen verständlichen Hinweis.
   ══════════════════════════════════════════════════════ */
(function ladeStudjoUiA11y() {
  if (
    window.__studjoUiA11yAktiv ||
    document.querySelector(
      'script[data-studjo-ui-a11y]'
    )
  ) {
    return;
  }

  const script =
    document.createElement(
      'script'
    );

  script.src =
    'ui-a11y.js';

  script.async =
    true;

  script.dataset
    .studjoUiA11y =
      'true';

  script.onerror =
    () => {
      console.warn(
        '[Studjo] ui-a11y.js konnte nicht geladen werden.'
      );
    };

  document.head
    .appendChild(
      script
    );
})();


/* ══════════════════════════════════════════════════════
   STARTSEITEN-TICKER LADEN
   Läuft nur dort, wo eine .ticker-container vorhanden ist.
   ══════════════════════════════════════════════════════ */
(function ladeStudjoTicker() {
  if (
    window.__studjoTickerAktiv ||
    document.querySelector(
      'script[data-studjo-ticker]'
    )
  ) {
    return;
  }

  const script =
    document.createElement(
      'script'
    );

  script.src =
    'ticker.js';

  script.async =
    true;

  script.dataset
    .studjoTicker =
      'true';

  script.onerror =
    () => {
      console.warn(
        '[Studjo] ticker.js konnte nicht geladen werden.'
      );
    };

  document.head
    .appendChild(
      script
    );
})();
