/* ══════════════════════════════════════════════════════
   ticker.js – robuste automatische Laufleiste auf der Studjo-Startseite
   Version 18

   Quelle: ticker.json
   - zeigt nur aktuell gültige Einträge
   - maximal 3–5 Einträge (laut ticker.json.maxEintraege)
   - Emoji wird visuell gezeigt, aber nicht vorgelesen
   - Links funktionieren auch in der für den Endloslauf nötigen Kopie
   - Stop/Play arbeitet über einen zentralen Status
   - Touch-Geräte werden nicht durch "hängendes" CSS-:hover blockiert
   - Web Animations API stabilisiert Pause/Weiterlauf in Chrome/Android
   - pausiert bei Maus über einer Meldung und bei Tastaturfokus
   - respektiert prefers-reduced-motion
   ══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  if (window.__studjoTickerAktiv) return;
  window.__studjoTickerAktiv = true;

  const container = document.querySelector('.ticker-container');
  if (!container) return;

  const alterText = container.querySelector('.ticker-text');
  if (!alterText) return;

  alterText.hidden = true;
  alterText.setAttribute('aria-hidden', 'true');

  let track = null;
  let stopButton = null;

  let manuellPausiert = false;
  let fokusPausiert = false;
  let mausPausiert = false;
  let interaktionPausiert = false;

  const reduzierteBewegung = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  function cssEinbauen() {
    if (document.getElementById('studjo-ticker-css')) return;

    const style = document.createElement('style');
    style.id = 'studjo-ticker-css';

    style.textContent = `
      .ticker-container {
        position: relative;
        overflow: hidden;
        background: #fff;
        padding: 8px 0 8px 42px;
        margin-bottom: 16px;
        border-bottom: 2px solid #f0f0f0;
        box-sizing: border-box;
      }

      .studjo-ticker-stop {
        position: absolute;
        left: 5px;
        top: 50%;
        transform: translateY(-50%);
        z-index: 10;
        width: 32px;
        height: 32px;
        border: 0;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 7px rgba(0,0,0,.14);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        cursor: pointer;
        font-size: 1rem;
        line-height: 1;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }

      .studjo-ticker-stop:hover {
        background: #f4f5f6;
      }

      .studjo-ticker-stop:focus-visible {
        outline: 3px solid #0f2f37;
        outline-offset: 2px;
      }

      .studjo-ticker-stop.is-paused {
        background: #f1f2f3;
        color: #4f595e;
      }

      .studjo-ticker-track {
        display: flex;
        width: max-content;
        align-items: center;
        white-space: nowrap;
        animation-name: studjo-ticker-scroll;
        animation-duration: var(--studjo-ticker-dauer, 34s);
        animation-timing-function: linear;
        animation-iteration-count: infinite;
        animation-play-state: running;
        will-change: transform;
        transform: translate3d(0,0,0);
        backface-visibility: hidden;
      }

      .studjo-ticker-gruppe {
        display: inline-flex;
        align-items: center;
        gap: 22px;
        flex: 0 0 auto;
        padding-right: 22px;
      }

      .studjo-ticker-eintrag {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        color: #202628;
        font-size: 1.02rem;
        font-weight: 800;
        line-height: 1.4;
        text-decoration: none;
        border-radius: 8px;
        padding: 2px 4px;
        touch-action: manipulation;
        -webkit-tap-highlight-color: rgba(182,31,41,.14);
      }

      a.studjo-ticker-eintrag,
      .studjo-ticker-kopie-link {
        color: #b61f29;
        text-decoration: none;
        cursor: pointer;
      }

      a.studjo-ticker-eintrag:hover,
      .studjo-ticker-kopie-link:hover {
        background: #f1f1f1;
        text-decoration: none;
      }

      a.studjo-ticker-eintrag:focus-visible {
        outline: 3px solid #0f2f37;
        outline-offset: 3px;
        background: #f1f1f1;
        text-decoration: none;
      }

      span.studjo-ticker-eintrag:not(.studjo-ticker-kopie-link) {
        color: #202628;
        cursor: pointer;
      }

      .studjo-ticker-symbol {
        font-family: "Segoe UI Emoji","Noto Color Emoji","Apple Color Emoji",sans-serif;
        font-size: 1.3rem;
        line-height: 1;
      }

      .studjo-ticker-trenner {
        color: #8a8d8f;
        font-weight: 800;
      }

      .studjo-ticker-loop-trenner {
        color: #b61f29;
        font-weight: 900;
        letter-spacing: .06em;
      }

      @keyframes studjo-ticker-scroll {
        from { transform: translate3d(0,0,0); }
        to   { transform: translate3d(-50%,0,0); }
      }

      @media (prefers-reduced-motion: reduce) {
        .ticker-container {
          overflow-x: auto;
          scrollbar-width: thin;
          padding-left: 8px;
        }

        .studjo-ticker-track {
          animation: none !important;
          transform: none !important;
          white-space: nowrap;
        }

        .studjo-ticker-gruppe[data-kopie="true"] {
          display: none;
        }

        .studjo-ticker-stop {
          display: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function parseIso(text) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text || ''));
    if (!m) return null;

    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function istAktuell(eintrag) {
    const heute = new Date();
    heute.setHours(0, 0, 0, 0);

    const von = parseIso(eintrag.von);
    const bis = parseIso(eintrag.bis);

    if (von && heute < von) return false;
    if (bis && heute > bis) return false;
    return true;
  }

  function navigationVorbereiten() {
    manuellPausiert = false;
    fokusPausiert = false;
    mausPausiert = false;
    interaktionPausiert = true;
    statusAnwenden();
  }

  function linkOeffnen(url) {
    if (!url) return;
    navigationVorbereiten();
    window.location.assign(url);
  }

  function eintragElement(eintrag, istKopie) {
    const link = String(eintrag.link || '').trim();
    const hatLink = Boolean(link);

    let el;

    if (hatLink && !istKopie) {
      el = document.createElement('a');
      el.href = link;
      el.dataset.tickerLink = link;
    } else {
      el = document.createElement('span');
      if (hatLink) {
        el.dataset.tickerLink = link;
        el.classList.add('studjo-ticker-kopie-link');
      }
    }

    el.classList.add('studjo-ticker-eintrag');

    const symbol = document.createElement('span');
    symbol.className = 'studjo-ticker-symbol';
    symbol.setAttribute('aria-hidden', 'true');
    symbol.textContent = eintrag.symbol || '📢';

    const text = document.createElement('span');
    text.textContent = eintrag.text || '';

    el.append(symbol, text);
    return el;
  }

  function animationenSetzen(pausiert) {
    if (!track) return;

    track.style.animationPlayState = pausiert ? 'paused' : 'running';

    if (typeof track.getAnimations === 'function') {
      try {
        track.getAnimations().forEach(animation => {
          if (pausiert) {
            animation.pause();
          } else {
            animation.play();
          }
        });
      } catch (e) {
        /* CSS animation-play-state bleibt der Fallback. */
      }
    }
  }

  function statusAnwenden() {
    const reduziert = Boolean(reduzierteBewegung && reduzierteBewegung.matches);

    const pausiert =
      reduziert ||
      manuellPausiert ||
      fokusPausiert ||
      mausPausiert ||
      interaktionPausiert;

    animationenSetzen(pausiert);

    container.classList.toggle(
      'studjo-ticker-manuell-pause',
      manuellPausiert
    );

    if (!stopButton) return;

    stopButton.classList.toggle('is-paused', manuellPausiert);

    stopButton.textContent = manuellPausiert ? '▶️' : '⏹️';
    stopButton.setAttribute('aria-pressed', manuellPausiert ? 'true' : 'false');
    stopButton.setAttribute(
      'aria-label',
      manuellPausiert ? 'Laufband starten' : 'Laufband stoppen'
    );
    stopButton.title = manuellPausiert ? 'Laufband starten' : 'Laufband stoppen';
  }

  function pauseStatusSetzen(pausiert) {
    manuellPausiert = Boolean(pausiert);

    if (!manuellPausiert) {
      interaktionPausiert = false;
      mausPausiert = false;
    }

    statusAnwenden();
  }

  function pauseUmschalten() {
    pauseStatusSetzen(!manuellPausiert);
  }

  function laufbandBeimZurueckkehrenStarten() {
    manuellPausiert = false;
    fokusPausiert = false;
    mausPausiert = false;
    interaktionPausiert = false;

    container.classList.remove('studjo-ticker-linkfokus');

    const aktiv = document.activeElement;
    if (
      aktiv &&
      aktiv.closest &&
      aktiv.closest('.ticker-container') &&
      typeof aktiv.blur === 'function'
    ) {
      aktiv.blur();
    }

    requestAnimationFrame(() => {
      statusAnwenden();
      requestAnimationFrame(statusAnwenden);
    });
  }

  window.addEventListener('pageshow', laufbandBeimZurueckkehrenStarten);

  window.addEventListener('pagehide', () => {
    manuellPausiert = false;
    fokusPausiert = false;
    mausPausiert = false;
    interaktionPausiert = false;
    container.classList.remove('studjo-ticker-linkfokus');
    statusAnwenden();
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !manuellPausiert) {
      mausPausiert = false;
      interaktionPausiert = false;
      requestAnimationFrame(statusAnwenden);
    }
  });

  document.addEventListener('click', event => {
    if (!manuellPausiert) return;

    if (event.target.closest && event.target.closest('.ticker-container')) return;

    if (
      event.target.closest &&
      event.target.closest('a,button,input,select,textarea,label,[role="button"]')
    ) {
      return;
    }

    pauseStatusSetzen(false);
  });

  function stoppSchalterErzeugen() {
    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'studjo-ticker-stop';
    button.textContent = '⏹️';
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', 'Laufband stoppen');
    button.title = 'Laufband stoppen';

    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();

      fokusPausiert = false;
      interaktionPausiert = false;
      mausPausiert = false;
      pauseUmschalten();

      if (!manuellPausiert && typeof button.blur === 'function') {
        button.blur();
      }
    });

    return button;
  }

  function dauerAktualisieren(originalGruppe) {
    if (!track || !originalGruppe) return;

    const breite = originalGruppe.getBoundingClientRect().width;
    if (!breite || !Number.isFinite(breite)) return;

    const sekunden = Math.max(24, Math.min(90, breite / 48));
    track.style.setProperty('--studjo-ticker-dauer', sekunden.toFixed(2) + 's');
  }

  function render(daten) {
    const alle = Array.isArray(daten.eintraege) ? daten.eintraege : [];

    const max = Math.max(
      1,
      Math.min(5, Number(daten.maxEintraege) || 5)
    );

    const aktuell = alle.filter(istAktuell).slice(0, max);

    if (!aktuell.length) {
      container.hidden = true;
      return;
    }

    cssEinbauen();

    track = document.createElement('div');
    track.className = 'studjo-ticker-track';

    function gruppeErzeugen(istKopie) {
      const gruppe = document.createElement('div');
      gruppe.className = 'studjo-ticker-gruppe';
      gruppe.dataset.kopie = istKopie ? 'true' : 'false';

      if (!istKopie) {
        gruppe.setAttribute('role', 'list');
      } else {
        gruppe.setAttribute('aria-hidden', 'true');
      }

      aktuell.forEach((eintrag, index) => {
        const element = eintragElement(eintrag, istKopie);

        if (!istKopie) {
          element.setAttribute('role', 'listitem');
        }

        gruppe.appendChild(element);

        if (index < aktuell.length - 1) {
          const trenner = document.createElement('span');
          trenner.className = 'studjo-ticker-trenner';
          trenner.setAttribute('aria-hidden', 'true');
          trenner.textContent = '+++';
          gruppe.appendChild(trenner);
        }
      });

      const loopTrenner = document.createElement('span');
      loopTrenner.className = 'studjo-ticker-loop-trenner';
      loopTrenner.setAttribute('aria-hidden', 'true');
      loopTrenner.textContent = '++++++';
      gruppe.appendChild(loopTrenner);

      return gruppe;
    }

    const originalGruppe = gruppeErzeugen(false);
    const kopieGruppe = gruppeErzeugen(true);

    track.append(originalGruppe, kopieGruppe);

    container.innerHTML = '';
    container.hidden = false;
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'Aktuelle Hinweise');

    stopButton = stoppSchalterErzeugen();
    container.append(stopButton, track);

    pauseStatusSetzen(false);

    container.addEventListener('pointerdown', event => {
      const eintrag = event.target.closest?.('.studjo-ticker-eintrag[data-ticker-link]');
      if (!eintrag) return;

      interaktionPausiert = true;
      statusAnwenden();
    });

    container.addEventListener('pointercancel', () => {
      interaktionPausiert = false;
      statusAnwenden();
    });

    container.addEventListener('click', event => {
      const linkEintrag = event.target.closest?.('.studjo-ticker-eintrag[data-ticker-link]');

      if (linkEintrag) {
        event.preventDefault();
        event.stopPropagation();
        linkOeffnen(linkEintrag.dataset.tickerLink);
        return;
      }

      if (event.target.closest?.('.studjo-ticker-stop')) return;

      interaktionPausiert = false;
      pauseUmschalten();
    });

    container.addEventListener('focusin', event => {
      if (event.target.closest?.('a.studjo-ticker-eintrag')) {
        fokusPausiert = true;
        container.classList.add('studjo-ticker-linkfokus');
        statusAnwenden();
      }
    });

    container.addEventListener('focusout', event => {
      const naechstes = event.relatedTarget;
      if (!naechstes?.closest?.('a.studjo-ticker-eintrag')) {
        fokusPausiert = false;
        container.classList.remove('studjo-ticker-linkfokus');
        statusAnwenden();
      }
    });

    container.addEventListener('pointerover', event => {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      if (!event.target.closest?.('.studjo-ticker-eintrag')) return;

      mausPausiert = true;
      statusAnwenden();
    });

    container.addEventListener('pointerout', event => {
      if (event.pointerType && event.pointerType !== 'mouse') return;

      const vonEintrag = event.target.closest?.('.studjo-ticker-eintrag');
      if (!vonEintrag) return;

      const zuEintrag = event.relatedTarget?.closest?.('.studjo-ticker-eintrag');
      if (zuEintrag) return;

      mausPausiert = false;
      statusAnwenden();
    });

    dauerAktualisieren(originalGruppe);

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready
        .then(() => dauerAktualisieren(originalGruppe))
        .catch(() => {});
    }

    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(() => dauerAktualisieren(originalGruppe));
      ro.observe(originalGruppe);
    } else {
      window.addEventListener(
        'resize',
        () => dauerAktualisieren(originalGruppe),
        { passive: true }
      );
    }

    if (reduzierteBewegung) {
      const motionAenderung = () => {
        statusAnwenden();
        dauerAktualisieren(originalGruppe);
      };

      if (typeof reduzierteBewegung.addEventListener === 'function') {
        reduzierteBewegung.addEventListener('change', motionAenderung);
      } else if (typeof reduzierteBewegung.addListener === 'function') {
        reduzierteBewegung.addListener(motionAenderung);
      }
    }
  }

  fetch('ticker.json?v=' + Date.now(), { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(render)
    .catch(fehler => {
      console.warn(
        '[Studjo Ticker] ticker.json konnte nicht geladen werden:',
        fehler
      );

      container.hidden = true;
    });

})();
