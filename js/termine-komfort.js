/* ══════════════════════════════════════════════════════
   termine-komfort.js
   Komfortfunktionen ausschließlich für termine.html

   - aktueller Tag wird nach dem Laden automatisch angezeigt
   - Button "Nächster Termin" direkt neben Monat-zurück
   - berücksichtigt Andachten, Werkstattfeste, Schließungstage,
     weitere Termine
   - Schulferien werden bei "Nächster Termin" bewusst ignoriert
   - barrierefreies Popup mit Vorlesen und Schließen
   ══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const KATEGORIEN = {
    andachten: {
      name: 'Andacht/Gespräch',
      icon: '⛪'
    },
    werkstattfeste: {
      name: 'Werkstattfest',
      icon: '🎉'
    },
    schliessungstage: {
      name: 'Schließungstag',
      icon: '🔒'
    },
    weitere: {
      name: 'Weiterer Termin',
      icon: '📌'
    }
  };

  const MONATE = [
    'Januar','Februar','März','April','Mai','Juni',
    'Juli','August','September','Oktober','November','Dezember'
  ];

  const WOCHENTAGE = [
    'Sonntag','Montag','Dienstag','Mittwoch',
    'Donnerstag','Freitag','Samstag'
  ];

  let letzterFokus = null;
  let vorlesenAktiv = false;
  let aktuelleAussage = null;

  function parseIso(text) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      String(text || '').trim()
    );

    if (!m) return null;

    const d = new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3])
    );

    if (
      d.getFullYear() !== Number(m[1]) ||
      d.getMonth() !== Number(m[2]) - 1 ||
      d.getDate() !== Number(m[3])
    ) {
      return null;
    }

    d.setHours(0, 0, 0, 0);
    return d;
  }

  function htmlSicher(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function bildPfad(bild) {
    let pfad = String(bild || '').trim();
    if (!pfad) return '';

    if (/^(?:https?:|data:|blob:|\/)/i.test(pfad)) {
      return pfad;
    }

    pfad = pfad.replace(/^\.\//, '');

    return pfad.startsWith('img/')
      ? pfad
      : 'img/' + pfad;
  }

  function bereinigterOrt(termin) {
    return String(
      termin?.ort ||
      termin?.titel ||
      ''
    )
      .replace(/^\s*(?:Betriebsstätte|BST)\s+/i, '')
      .trim();
  }

  function datumText(datum) {
    return (
      WOCHENTAGE[datum.getDay()] + ', ' +
      datum.getDate() + '. ' +
      MONATE[datum.getMonth()] + ' ' +
      datum.getFullYear()
    );
  }

  function tageDifferenz(von, bis) {
    const a = new Date(
      von.getFullYear(),
      von.getMonth(),
      von.getDate()
    );

    const b = new Date(
      bis.getFullYear(),
      bis.getMonth(),
      bis.getDate()
    );

    return Math.round((b - a) / 86400000);
  }

  function relativeBezeichnung(datum) {
    const heute = new Date();
    heute.setHours(0, 0, 0, 0);

    const diff = tageDifferenz(heute, datum);

    if (diff === 0) return 'Heute';
    if (diff === 1) return 'Morgen';
    return 'In ' + diff + ' Tagen';
  }

  function istTerminAmTag(termin, datum) {
    const von = parseIso(termin?.von);
    const bis = parseIso(termin?.bis || termin?.von);

    if (!von || !bis || bis < von) return false;

    return datum >= von && datum <= bis;
  }

  function findeNaechsteTermine() {
    const daten = window.StudjoTermineDaten;
    const liste = Array.isArray(daten?.termine)
      ? daten.termine
      : [];

    const heute = new Date();
    heute.setHours(0, 0, 0, 0);

    const kandidaten = liste
      .filter(t => KATEGORIEN[t?.kategorie])
      .map(t => {
        const von = parseIso(t.von);
        const bis = parseIso(t.bis || t.von);

        if (!von || !bis || bis < heute) return null;

        const wirksamesDatum =
          heute >= von && heute <= bis
            ? new Date(heute)
            : von;

        return {
          termin: t,
          datum: wirksamesDatum
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.datum - b.datum);

    if (!kandidaten.length) {
      return {
        datum: null,
        termine: []
      };
    }

    const naechstesDatum = kandidaten[0].datum;

    const termine = liste.filter(t =>
      KATEGORIEN[t?.kategorie] &&
      istTerminAmTag(t, naechstesDatum)
    );

    return {
      datum: naechstesDatum,
      termine
    };
  }

  function injiziereStyles() {
    if (document.getElementById('studjo-termine-komfort-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'studjo-termine-komfort-styles';

    style.textContent = `
      /* Fünf Elemente in der Kalendernavigation:
         Zurück | Nächster Termin | Monat | Heute | Vor */
      #ke-zurueck {
        grid-column:1;
      }

      #ke-naechster-termin {
        grid-column:2;
      }

      #ke-titel {
        grid-column:3;
      }

      #ke-heute {
        grid-column:4;
      }

      #ke-vor {
        grid-column:5;
      }

      #ke-zurueck,
      #ke-naechster-termin,
      #ke-titel,
      #ke-heute,
      #ke-vor {
        grid-row:1;
      }

      #ke-zurueck + #ke-naechster-termin {
        margin-left:0;
      }

      .studjo-kal-nav:has(#ke-naechster-termin) {
        grid-template-columns:
          40px auto minmax(120px,1fr) auto 40px;
      }

      .studjo-kal-naechster {
        height:40px;
        min-width:126px;
        padding:0 13px;
        border:2px solid #b61f29;
        border-radius:12px;
        background:#b61f29;
        color:#fff;
        font:inherit;
        font-size:.82rem;
        line-height:1.1;
        font-weight:900;
        cursor:pointer;
        display:flex;
        align-items:center;
        justify-content:center;
        text-align:center;
      }

      .studjo-kal-naechster:hover,
      .studjo-kal-naechster:focus-visible {
        background:#8f1720;
        border-color:#8f1720;
        outline:3px solid rgba(182,31,41,.22);
      }

      .studjo-naechster-overlay {
        display:none;
        position:fixed;
        inset:0;
        z-index:2300;
        background:rgba(0,0,0,.62);
        align-items:center;
        justify-content:center;
        padding:18px;
      }

      .studjo-naechster-dialog {
        width:min(540px,100%);
        max-height:90vh;
        overflow-y:auto;
        position:relative;
        background:#fff;
        border-radius:18px;
        box-shadow:0 12px 44px rgba(0,0,0,.34);
        padding:24px 22px 22px;
        color:#0f2f37;
      }

      .studjo-naechster-aktionen {
        position:absolute;
        top:10px;
        right:10px;
        display:flex;
        gap:8px;
      }

      .studjo-naechster-iconbtn {
        width:38px;
        height:38px;
        border:0;
        border-radius:50%;
        background:#f1f2f3;
        color:#0f2f37;
        font:inherit;
        font-size:1.15rem;
        font-weight:900;
        cursor:pointer;
        display:flex;
        align-items:center;
        justify-content:center;
      }

      .studjo-naechster-iconbtn.aktiv {
        background:#ffe600;
      }

      .studjo-naechster-titel {
        margin:0 90px 4px 0;
        color:#b61f29;
        font-size:1.35rem;
        line-height:1.2;
        font-weight:900;
      }

      .studjo-naechster-relative {
        display:inline-block;
        margin:8px 0 5px;
        padding:5px 10px;
        border-radius:999px;
        background:#fdebed;
        color:#a71923;
        font-size:.82rem;
        font-weight:900;
      }

      .studjo-naechster-datum {
        margin:4px 0 14px;
        font-size:1.05rem;
        font-weight:900;
      }

      .studjo-naechster-liste {
        display:flex;
        flex-direction:column;
        gap:10px;
      }

      .studjo-naechster-eintrag {
        position:relative;
        border:1px solid #e1e5e8;
        border-left:5px solid #b61f29;
        border-radius:12px;
        padding:12px 76px 12px 13px;
        background:#f8f9fa;
        line-height:1.45;
        min-height:70px;
      }

      .studjo-naechster-kategorie {
        display:block;
        margin-bottom:3px;
        color:#697176;
        font-size:.76rem;
        font-weight:900;
        text-transform:uppercase;
        letter-spacing:.03em;
      }

      .studjo-naechster-ort {
        display:block;
        font-size:1.05rem;
        font-weight:900;
        color:#0f2f37;
      }

      .studjo-naechster-detail {
        display:block;
        margin-top:4px;
        color:#4f565a;
        font-size:.92rem;
      }

      .studjo-naechster-bild {
        position:absolute;
        top:11px;
        right:11px;
        width:52px;
        height:52px;
        border-radius:8px;
        object-fit:cover;
        border:1px solid #d8dde0;
        background:#fff;
      }

      .studjo-naechster-leer {
        padding:16px;
        border-radius:12px;
        background:#f5f6f7;
        color:#5f676c;
        font-weight:700;
      }

      .studjo-naechster-dialog .is-reading {
        background:#ffe600 !important;
        color:#000 !important;
        border-radius:7px;
        box-shadow:0 0 0 4px rgba(255,230,0,.30) !important;
      }

      @media (max-width:680px) {
        .studjo-kal-nav:has(#ke-naechster-termin) {
          grid-template-columns:
            36px minmax(102px,auto) minmax(70px,1fr) 58px 36px;
          gap:5px;
        }

        .studjo-kal-naechster {
          min-width:0;
          height:36px;
          padding:0 7px;
          font-size:.72rem;
        }

        #ke-titel {
          font-size:.92rem;
        }
      }

      @media (max-width:430px) {
        .studjo-kal-nav:has(#ke-naechster-termin) {
          grid-template-columns:
            36px minmax(92px,auto) minmax(54px,1fr) 54px 36px;
        }

        .studjo-kal-naechster {
          font-size:.67rem;
          padding:0 5px;
        }

        #ke-heute {
          min-width:54px;
          padding:0 5px;
          font-size:.70rem;
        }

        #ke-titel {
          font-size:.84rem;
        }

        .studjo-naechster-dialog {
          padding:22px 16px 18px;
        }

        .studjo-naechster-eintrag {
          padding-right:68px;
        }

        .studjo-naechster-bild {
          width:46px;
          height:46px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function popupMarkup() {
    return `
      <div id="studjo-naechster-overlay"
           class="studjo-naechster-overlay"
           role="dialog"
           aria-modal="true"
           aria-labelledby="studjo-naechster-titel">

        <div class="studjo-naechster-dialog">
          <div class="studjo-naechster-aktionen">
            <button type="button"
                    id="studjo-naechster-vorlesen"
                    class="studjo-naechster-iconbtn"
                    aria-label="Nächsten Termin vorlesen"
                    title="Vorlesen">👂</button>

            <button type="button"
                    id="studjo-naechster-schliessen"
                    class="studjo-naechster-iconbtn"
                    aria-label="Fenster schließen"
                    title="Schließen">✕</button>
          </div>

          <h2 id="studjo-naechster-titel"
              class="studjo-naechster-titel">
            Nächster Termin
          </h2>

          <div id="studjo-naechster-inhalt"></div>
        </div>
      </div>
    `;
  }

  function stoppeVorlesen() {
    vorlesenAktiv = false;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    aktuelleAussage = null;

    document
      .querySelectorAll('#studjo-naechster-overlay .is-reading')
      .forEach(el => el.classList.remove('is-reading'));

    document
      .getElementById('studjo-naechster-vorlesen')
      ?.classList.remove('aktiv');
  }

  function schliessePopup() {
    stoppeVorlesen();

    const overlay = document.getElementById(
      'studjo-naechster-overlay'
    );

    if (overlay) overlay.style.display = 'none';

    if (
      letzterFokus &&
      typeof letzterFokus.focus === 'function'
    ) {
      letzterFokus.focus();
    }
  }

  function injizierePopup() {
    if (document.getElementById('studjo-naechster-overlay')) {
      return;
    }

    document.body.insertAdjacentHTML(
      'beforeend',
      popupMarkup()
    );

    const overlay = document.getElementById(
      'studjo-naechster-overlay'
    );

    overlay.addEventListener('click', event => {
      if (event.target === overlay) schliessePopup();
    });

    document
      .getElementById('studjo-naechster-schliessen')
      .addEventListener('click', schliessePopup);

    document
      .getElementById('studjo-naechster-vorlesen')
      .addEventListener('click', function () {
        vorlesenPopup(this);
      });

    document.addEventListener('keydown', event => {
      if (
        event.key === 'Escape' &&
        overlay.style.display === 'flex'
      ) {
        schliessePopup();
      }
    });
  }

  function terminHtml(termin) {
    const cfg = KATEGORIEN[termin.kategorie];
    const ort = bereinigterOrt(termin) || cfg.name;
    const bild = bildPfad(termin.bild);

    const bildHtml = bild
      ? `<img src="${htmlSicher(bild)}"
              class="studjo-naechster-bild"
              alt="Gebäude ${htmlSicher(ort)}"
              onerror="this.style.display='none'">`
      : '';

    const details = [];

    if (termin.uhrzeit) {
      details.push(
        `<span class="studjo-naechster-detail">🕐 ${htmlSicher(termin.uhrzeit)}</span>`
      );
    }

    if (termin.ansprechpartner) {
      details.push(
        `<span class="studjo-naechster-detail">👤 ${htmlSicher(termin.ansprechpartner)}</span>`
      );
    }

    if (termin.hinweis) {
      details.push(
        `<span class="studjo-naechster-detail">${htmlSicher(termin.hinweis)}</span>`
      );
    }

    return `
      <div class="studjo-naechster-eintrag"
           data-vorlesen-naechster>
        ${bildHtml}
        <span class="studjo-naechster-kategorie">
          ${htmlSicher(cfg.icon + ' ' + cfg.name)}
        </span>
        <span class="studjo-naechster-ort">
          ${htmlSicher(ort)}
        </span>
        ${details.join('')}
      </div>
    `;
  }

  async function oeffneNaechstenTermin(button) {
    letzterFokus = button;

    if (
      window.StudjoKalender &&
      typeof window.StudjoKalender.datenBereit === 'function'
    ) {
      await window.StudjoKalender.datenBereit();
    }

    injizierePopup();

    const gefunden = findeNaechsteTermine();
    const inhalt = document.getElementById(
      'studjo-naechster-inhalt'
    );

    if (!gefunden.datum || !gefunden.termine.length) {
      inhalt.innerHTML = `
        <div class="studjo-naechster-leer"
             data-vorlesen-naechster>
          Aktuell ist kein weiterer Termin eingetragen.
        </div>
      `;
    } else {
      inhalt.innerHTML = `
        <div class="studjo-naechster-relative"
             data-vorlesen-naechster>
          ${htmlSicher(relativeBezeichnung(gefunden.datum))}
        </div>

        <div class="studjo-naechster-datum"
             data-vorlesen-naechster>
          ${htmlSicher(datumText(gefunden.datum))}
        </div>

        <div class="studjo-naechster-liste">
          ${gefunden.termine.map(terminHtml).join('')}
        </div>
      `;
    }

    const overlay = document.getElementById(
      'studjo-naechster-overlay'
    );

    overlay.style.display = 'flex';

    document
      .getElementById('studjo-naechster-schliessen')
      .focus();
  }

  function bereiteSpracheVor(text) {
    return String(text || '')
      .replace(/\p{Extended_Pictographic}/gu, '')
      .replace(
        /(\d{1,2}[:.]\d{2})\s*[–—-]\s*(\d{1,2}[:.]\d{2})/g,
        'von $1 bis $2'
      )
      .replace(/\s+/g, ' ')
      .trim();
  }

  function vorlesenPopup(button) {
    if (!('speechSynthesis' in window)) {
      alert(
        'Dein Browser unterstützt leider keine Sprachausgabe.'
      );
      return;
    }

    if (
      vorlesenAktiv ||
      window.speechSynthesis.speaking
    ) {
      stoppeVorlesen();
      return;
    }

    const overlay = document.getElementById(
      'studjo-naechster-overlay'
    );

    if (!overlay) return;

    const elemente = [
      overlay.querySelector('.studjo-naechster-titel'),
      ...overlay.querySelectorAll('[data-vorlesen-naechster]')
    ]
      .filter(Boolean)
      .map(element => ({
        element,
        text: bereiteSpracheVor(element.innerText)
      }))
      .filter(x => x.text);

    if (!elemente.length) return;

    vorlesenAktiv = true;
    button.classList.add('aktiv');

    function spiele(index) {
      if (
        !vorlesenAktiv ||
        index >= elemente.length
      ) {
        stoppeVorlesen();
        return;
      }

      const abschnitt = elemente[index];

      aktuelleAussage = new SpeechSynthesisUtterance(
        abschnitt.text
      );
      aktuelleAussage.lang = 'de-DE';
      aktuelleAussage.rate = 0.90;

      aktuelleAussage.onstart = () => {
        overlay
          .querySelectorAll('.is-reading')
          .forEach(el => el.classList.remove('is-reading'));

        abschnitt.element.classList.add('is-reading');
      };

      aktuelleAussage.onend = () => {
        setTimeout(
          () => spiele(index + 1),
          220
        );
      };

      aktuelleAussage.onerror = stoppeVorlesen;

      window.speechSynthesis.speak(
        aktuelleAussage
      );
    }

    spiele(0);
  }

  function fuegeNaechsterButtonEin() {
    const zurueck = document.getElementById('ke-zurueck');
    if (!zurueck) return false;

    if (document.getElementById('ke-naechster-termin')) {
      return true;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'ke-naechster-termin';
    button.className = 'studjo-kal-naechster';
    button.textContent = 'Nächster Termin';
    button.setAttribute(
      'aria-label',
      'Nächsten eingetragenen Termin anzeigen'
    );

    button.addEventListener('click', () => {
      oeffneNaechstenTermin(button);
    });

    zurueck.insertAdjacentElement(
      'afterend',
      button
    );

    return true;
  }

  async function zeigeHeutigenTagAutomatisch() {
    if (
      window.StudjoKalender &&
      typeof window.StudjoKalender.datenBereit === 'function'
    ) {
      await window.StudjoKalender.datenBereit();
    }

    const heuteButton = document.getElementById('ke-heute');

    /* Bestehende Kalenderfunktion bewusst wiederverwenden:
       Sie zeichnet auf den aktuellen Monat zurück und befüllt
       den unteren Infobereich mit den Daten des heutigen Tages. */
    if (heuteButton) {
      heuteButton.click();
    }
  }

  async function initialisieren() {
    /* Der obere Seitentext ersetzt den bisherigen doppelten Hinweis. */
    const hinweis = document.querySelector('.seiten-hinweis');
    if (hinweis) {
      hinweis.textContent =
        'Tippe auf einen Tag für mehr Infos.';
    }

    injiziereStyles();

    /* kalender.js baut den eingebetteten Kalender beim DOM-Start.
       Kurz warten, bis dessen Navigation vorhanden ist. */
    for (let i = 0; i < 50; i++) {
      if (fuegeNaechsterButtonEin()) break;

      await new Promise(resolve =>
        setTimeout(resolve, 50)
      );
    }

    await zeigeHeutigenTagAutomatisch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initialisieren,
      { once: true }
    );
  } else {
    initialisieren();
  }

})();
