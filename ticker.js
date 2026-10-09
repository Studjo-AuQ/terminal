/* ══════════════════════════════════════════════════════
   ticker.js – automatische Laufleiste auf der Studjo-Startseite

   Quelle: ticker.json
   - zeigt nur aktuell gültige Einträge
   - maximal 3–5 Einträge (laut ticker.json.maxEintraege)
   - Emoji wird visuell gezeigt, aber nicht vorgelesen
   - Links können direkt zur passenden Neuigkeit springen
   - pausiert bei Hover und Tastaturfokus
   - respektiert prefers-reduced-motion
   ══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  if (window.__studjoTickerAktiv) return;
  window.__studjoTickerAktiv = true;

  const container =
    document.querySelector(
      '.ticker-container'
    );

  if (!container) return;

  const alterText =
    container.querySelector(
      '.ticker-text'
    );

  if (!alterText) return;

  /* Bestehenden statischen Quelltext nicht mehr anzeigen.
     Er bleibt lediglich als Fallback erhalten, falls JavaScript
     komplett deaktiviert sein sollte. */
  alterText.hidden = true;
  alterText.setAttribute(
    'aria-hidden',
    'true'
  );

  function cssEinbauen() {
    if (
      document.getElementById(
        'studjo-ticker-css'
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        'style'
      );

    style.id =
      'studjo-ticker-css';

    style.textContent = `
      .ticker-container {
        position: relative;
        overflow: hidden;
        background: #fff;
        padding: 8px 0 8px 42px;
        margin-bottom: 16px;
        border-bottom: 2px solid #f0f0f0;
      }

      .studjo-ticker-stop {
        position: absolute;
        left: 5px;
        top: 50%;
        transform: translateY(-50%);
        z-index: 5;
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
      }

      .studjo-ticker-stop:hover {
        background: #f4f5f6;
      }

      .studjo-ticker-stop:focus-visible {
        outline: 3px solid #0f2f37;
        outline-offset: 2px;
      }

      .studjo-ticker-stop.is-paused {
        filter: grayscale(1);
        opacity: .52;
      }

      .studjo-ticker-stop.is-paused::after {
        content: "";
        position: absolute;
        width: 23px;
        height: 2px;
        background: #555;
        transform: rotate(-45deg);
        border-radius: 2px;
        pointer-events: none;
      }

      .studjo-ticker-track {
        display: inline-flex;
        align-items: center;
        gap: 22px;
        white-space: nowrap;
        padding-left: 100%;
        min-width: max-content;
        animation: studjo-ticker-scroll 42s linear infinite;
        will-change: transform;
      }

      .ticker-container:hover .studjo-ticker-track,
      .ticker-container:focus-within .studjo-ticker-track,
      .ticker-container.studjo-ticker-manuell-pause .studjo-ticker-track {
        animation-play-state: paused;
      }

      .studjo-ticker-eintrag {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        color: #b61f29;
        font-size: 1.02rem;
        font-weight: 800;
        line-height: 1.4;
        text-decoration: none;
        border-radius: 8px;
        padding: 2px 4px;
      }

      a.studjo-ticker-eintrag:hover {
        text-decoration: underline;
      }

      span.studjo-ticker-eintrag {
        cursor: pointer;
      }

      a.studjo-ticker-eintrag:focus-visible {
        outline: 3px solid #0f2f37;
        outline-offset: 3px;
        text-decoration: underline;
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

      @keyframes studjo-ticker-scroll {
        from { transform: translateX(0); }
        to   { transform: translateX(-100%); }
      }

      @media (prefers-reduced-motion: reduce) {
        .ticker-container {
          overflow-x: auto;
          scrollbar-width: thin;
        }

        .studjo-ticker-track {
          padding-left: 0;
          animation: none;
          white-space: nowrap;
        }

        .studjo-ticker-stop {
          position: sticky;
          left: 5px;
        }
      }
    `;

    document.head
      .appendChild(
        style
      );
  }

  function parseIso(text) {
    const m =
      /^(\d{4})-(\d{2})-(\d{2})$/
        .exec(
          String(text || '')
        );

    if (!m) return null;

    const d =
      new Date(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3])
      );

    d.setHours(0,0,0,0);
    return d;
  }

  function istAktuell(eintrag) {
    const heute =
      new Date();

    heute.setHours(0,0,0,0);

    const von =
      parseIso(
        eintrag.von
      );

    const bis =
      parseIso(
        eintrag.bis
      );

    if (
      von &&
      heute < von
    ) {
      return false;
    }

    if (
      bis &&
      heute > bis
    ) {
      return false;
    }

    return true;
  }

  function eintragElement(eintrag) {
    const hatLink =
      Boolean(
        String(
          eintrag.link || ''
        ).trim()
      );

    const el =
      document.createElement(
        hatLink
          ? 'a'
          : 'span'
      );

    el.className =
      'studjo-ticker-eintrag';

    if (hatLink) {
      el.href =
        eintrag.link;
    }

    const symbol =
      document.createElement(
        'span'
      );

    symbol.className =
      'studjo-ticker-symbol';

    symbol.setAttribute(
      'aria-hidden',
      'true'
    );

    symbol.textContent =
      eintrag.symbol || '📢';

    const text =
      document.createElement(
        'span'
      );

    text.textContent =
      eintrag.text || '';

    el.append(
      symbol,
      text
    );

    return el;
  }

  let manuellPausiert = false;
  let stopButton = null;

  function pauseStatusSetzen(pausiert) {
    manuellPausiert =
      Boolean(pausiert);

    container.classList.toggle(
      'studjo-ticker-manuell-pause',
      manuellPausiert
    );

    if (!stopButton) return;

    stopButton.classList.toggle(
      'is-paused',
      manuellPausiert
    );

    stopButton.setAttribute(
      'aria-pressed',
      manuellPausiert
        ? 'true'
        : 'false'
    );

    stopButton.setAttribute(
      'aria-label',
      manuellPausiert
        ? 'Laufband wieder starten'
        : 'Laufband anhalten'
    );

    stopButton.title =
      manuellPausiert
        ? 'Laufband wieder starten'
        : 'Laufband anhalten';
  }

  function pauseUmschalten() {
    pauseStatusSetzen(
      !manuellPausiert
    );
  }

  function stoppSchalterErzeugen() {
    const button =
      document.createElement(
        'button'
      );

    button.type =
      'button';

    button.className =
      'studjo-ticker-stop';

    button.textContent =
      '⏹️';

    button.setAttribute(
      'aria-pressed',
      'false'
    );

    button.setAttribute(
      'aria-label',
      'Laufband anhalten'
    );

    button.title =
      'Laufband anhalten';

    button.addEventListener(
      'click',
      event => {
        event.preventDefault();
        event.stopPropagation();
        pauseUmschalten();
      }
    );

    return button;
  }

  function render(daten) {
    const alle =
      Array.isArray(
        daten.eintraege
      )
        ? daten.eintraege
        : [];

    const max =
      Math.max(
        1,
        Math.min(
          5,
          Number(
            daten.maxEintraege
          ) || 5
        )
      );

    const aktuell =
      alle
        .filter(istAktuell)
        .slice(0, max);

    if (!aktuell.length) {
      container.hidden = true;
      return;
    }

    cssEinbauen();

    const track =
      document.createElement(
        'div'
      );

    track.className =
      'studjo-ticker-track';

    track.setAttribute(
      'role',
      'list'
    );

    aktuell.forEach(
      (eintrag, index) => {
        const element =
          eintragElement(
            eintrag
          );

        element.setAttribute(
          'role',
          'listitem'
        );

        track.appendChild(
          element
        );

        if (
          index <
          aktuell.length - 1
        ) {
          const trenner =
            document.createElement(
              'span'
            );

          trenner.className =
            'studjo-ticker-trenner';

          trenner.setAttribute(
            'aria-hidden',
            'true'
          );

          trenner.textContent =
            '+++';

          track.appendChild(
            trenner
          );
        }
      }
    );

    container.innerHTML = '';
    container.hidden = false;

    container.setAttribute(
      'role',
      'region'
    );

    container.setAttribute(
      'aria-label',
      'Aktuelle Hinweise'
    );

    stopButton =
      stoppSchalterErzeugen();

    container.append(
      stopButton,
      track
    );

    pauseStatusSetzen(
      false
    );

    /* Alternative Bedienung:
       Klick auf eine nicht verlinkte Stelle im Laufband
       hält an bzw. startet wieder.
       Klicks auf echte Links bleiben davon unberührt. */
    container.addEventListener(
      'click',
      event => {
        if (
          event.target.closest(
            'a'
          )
        ) {
          return;
        }

        if (
          event.target.closest(
            '.studjo-ticker-stop'
          )
        ) {
          return;
        }

        pauseUmschalten();
      }
    );
  }

  fetch(
    'ticker.json?v=' +
    Date.now()
  )
    .then(r => {
      if (!r.ok) {
        throw new Error(
          'HTTP ' + r.status
        );
      }

      return r.json();
    })
    .then(render)
    .catch(fehler => {
      console.warn(
        '[Studjo Ticker] ticker.json konnte nicht geladen werden:',
        fehler
      );

      /* Keine veralteten manuellen Meldungen zeigen. */
      container.hidden = true;
    });

})();
