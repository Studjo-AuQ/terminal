/* ══════════════════════════════════════════════════════
   pflegezentrale-link.js
   Fügt auf der Startseite den unaufdringlichen Admin-Zugang
   zwischen Kachel-Stift und QR-Code ein.

   Die Pflegezentrale selbst verändert das Terminal nicht.
   Erst ein späterer GitHub-Upload durch eine berechtigte Person
   veröffentlicht Änderungen.
   ══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const dateiname = location.pathname.split('/').pop();
  const istStartseite =
    dateiname === '' ||
    dateiname === 'index.html';

  if (!istStartseite) return;

  function cssEinbauen() {
    if (document.getElementById('pflegezentrale-link-styles')) return;

    const style = document.createElement('style');
    style.id = 'pflegezentrale-link-styles';
    style.textContent = `
      #pflegezentrale-footer-btn {
        position:absolute;
        right:58px;
        top:50%;
        transform:translateY(-50%);
        background:rgba(255,255,255,0.18);
        border:2px solid rgba(255,255,255,0.55);
        border-radius:8px;
        width:38px;
        height:38px;
        cursor:pointer;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:1.25rem;
        padding:0;
        color:#fff;
        line-height:1;
      }

      #pflegezentrale-footer-btn:hover,
      #pflegezentrale-footer-btn:focus-visible {
        background:rgba(255,255,255,0.32);
        outline:2px solid #fff;
      }

      /* Der bisherige Stift rückt eine Position nach links.
         Reihenfolge rechts: Stift | Pflegezentrale | QR. */
      #seitenende #kacheln-anordnen-btn {
        right:102px !important;
      }

      @media (max-width:600px) {
        #seitenende {
          padding:10px 14px 58px !important;
        }

        #seitenende #pflegezentrale-footer-btn {
          top:auto !important;
          right:58px !important;
          bottom:10px !important;
          transform:none !important;
        }

        #seitenende #kacheln-anordnen-btn {
          top:auto !important;
          right:102px !important;
          bottom:10px !important;
          transform:none !important;
        }

        #seitenende button[aria-label="QR-Code zum Scannen anzeigen"] {
          top:auto !important;
          right:14px !important;
          bottom:10px !important;
          transform:none !important;
        }

        #seitenende > button[aria-label="Nach oben zur Seitenüberschrift scrollen"] {
          top:auto !important;
          bottom:10px !important;
          transform:none !important;
        }
      }

      #pflegezentrale-popup {
        display:none;
        position:fixed;
        inset:0;
        z-index:2700;
        background:rgba(0,0,0,0.62);
        align-items:center;
        justify-content:center;
        padding:20px;
      }

      #pflegezentrale-popup-box {
        width:min(600px,100%);
        max-height:90vh;
        overflow:auto;
        position:relative;
        box-sizing:border-box;
        background:#fff;
        color:#0f2f37;
        border-radius:16px;
        box-shadow:0 10px 40px rgba(0,0,0,0.35);
        padding:30px 30px 26px;
        text-align:left;
      }

      .pflegezentrale-popup-iconbtn {
        position:absolute;
        top:10px;
        width:32px;
        height:32px;
        border:0;
        border-radius:50%;
        background:#f1f1f1;
        color:#0f2f37;
        cursor:pointer;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:1.05rem;
        line-height:1;
      }

      #pflegezentrale-popup-ohr {
        right:52px;
      }

      #pflegezentrale-popup-schliessen {
        right:10px;
      }

      #pflegezentrale-popup-ohr.aktiv {
        background:#ffe600;
      }

      #pflegezentrale-popup h2 {
        margin:0 70px 14px 0;
        color:#b61f29;
        font-size:1.3rem;
        line-height:1.25;
        font-weight:800;
      }

      #pflegezentrale-popup-text {
        font-size:1rem;
        line-height:1.65;
      }

      #pflegezentrale-popup-text p {
        margin:0 0 12px;
      }

      #pflegezentrale-popup-text ul {
        margin:0 0 18px;
        padding-left:22px;
      }

      .pflegezentrale-popup-actions {
        display:flex;
        gap:10px;
        flex-wrap:wrap;
      }

      .pflegezentrale-popup-primary,
      .pflegezentrale-popup-secondary {
        min-height:44px;
        padding:10px 18px;
        border-radius:999px;
        font:inherit;
        font-weight:800;
        cursor:pointer;
        display:inline-flex;
        align-items:center;
        justify-content:center;
      }

      .pflegezentrale-popup-primary {
        border:2px solid #b61f29;
        background:#b61f29;
        color:#fff;
      }

      .pflegezentrale-popup-secondary {
        border:2px solid #b61f29;
        background:#fff;
        color:#b61f29;
      }

      @media (max-width:520px) {
        #pflegezentrale-popup-box {
          padding:26px 18px 20px;
        }

        .pflegezentrale-popup-actions {
          flex-direction:column;
        }

        .pflegezentrale-popup-primary,
        .pflegezentrale-popup-secondary {
          width:100%;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function popupEinbauen() {
    if (document.getElementById('pflegezentrale-popup')) return;

    const overlay = document.createElement('div');
    overlay.id = 'pflegezentrale-popup';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'pflegezentrale-popup-titel');

    overlay.innerHTML = `
      <div id="pflegezentrale-popup-box">
        <button type="button"
                id="pflegezentrale-popup-ohr"
                class="pflegezentrale-popup-iconbtn"
                aria-label="Hinweis vorlesen"
                title="Hinweis vorlesen">👂</button>

        <button type="button"
                id="pflegezentrale-popup-schliessen"
                class="pflegezentrale-popup-iconbtn"
                aria-label="Schließen"
                title="Schließen">✕</button>

        <h2 id="pflegezentrale-popup-titel">
          🛠️ Pflegezentrale – nur für Admins
        </h2>

        <div id="pflegezentrale-popup-text">
          <p>
            Die Pflegezentrale ist ein Werkzeug für Mitarbeitende,
            die Inhalte des Studjo-Terminals pflegen.
          </p>
          <ul>
            <li>Die Seite darf auch von anderen Personen geöffnet werden.</li>
            <li>Bearbeitungen wirken nur lokal im jeweiligen Browser.</li>
            <li>Am Studjo-Terminal ändert sich dadurch noch nichts.</li>
            <li>Erst eine berechtigte Person mit GitHub-Zugang kann exportierte Dateien hochladen und damit veröffentlichen.</li>
            <li>Die Pflegezentrale speichert kein GitHub-Passwort und keinen Zugriffsschlüssel.</li>
          </ul>
        </div>

        <div class="pflegezentrale-popup-actions">
          <button type="button"
                  id="pflegezentrale-popup-oeffnen"
                  class="pflegezentrale-popup-primary">
            🛠️ Pflegezentrale öffnen
          </button>

          <button type="button"
                  id="pflegezentrale-popup-abbrechen"
                  class="pflegezentrale-popup-secondary">
            Abbrechen
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener('click', event => {
      if (event.target === overlay) popupSchliessen();
    });

    overlay.querySelector('#pflegezentrale-popup-schliessen')
      .addEventListener('click', popupSchliessen);

    overlay.querySelector('#pflegezentrale-popup-abbrechen')
      .addEventListener('click', popupSchliessen);

    overlay.querySelector('#pflegezentrale-popup-ohr')
      .addEventListener('click', function () {
        vorlesenUmschalten(this);
      });

    overlay.querySelector('#pflegezentrale-popup-oeffnen')
      .addEventListener('click', pflegezentraleOeffnen);

    document.addEventListener('keydown', event => {
      if (
        event.key === 'Escape' &&
        overlay.style.display === 'flex'
      ) {
        popupSchliessen();
      }
    });
  }

  function footerButtonEinbauen() {
    if (document.getElementById('pflegezentrale-footer-btn')) return;

    const footer = document.getElementById('seitenende');
    const stift = document.getElementById('kacheln-anordnen-btn');

    if (!footer || !stift) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'pflegezentrale-footer-btn';
    button.setAttribute(
      'aria-label',
      'Pflegezentrale für Admins öffnen'
    );
    button.title = 'Pflegezentrale';
    button.textContent = '🛠️';

    button.addEventListener('click', popupOeffnen);

    /* Der Button wird bewusst direkt nach dem Stift eingefügt.
       Visuell liegt er über CSS zwischen Stift und QR-Code. */
    stift.insertAdjacentElement('afterend', button);
  }

  function popupOeffnen() {
    const popup = document.getElementById('pflegezentrale-popup');
    if (!popup) return;

    popup.style.display = 'flex';

    document
      .getElementById('pflegezentrale-popup-schliessen')
      ?.focus();
  }

  function popupSchliessen() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    const ohr = document.getElementById(
      'pflegezentrale-popup-ohr'
    );

    if (ohr) ohr.classList.remove('aktiv');

    const popup = document.getElementById('pflegezentrale-popup');
    if (popup) popup.style.display = 'none';

    document
      .getElementById('pflegezentrale-footer-btn')
      ?.focus();
  }

  function vorlesenUmschalten(button) {
    if (!('speechSynthesis' in window)) {
      alert(
        'Dein Browser unterstützt leider keine Sprachausgabe.'
      );
      return;
    }

    if (
      button.classList.contains('aktiv') ||
      window.speechSynthesis.speaking
    ) {
      window.speechSynthesis.cancel();
      button.classList.remove('aktiv');
      return;
    }

    const titel = document
      .getElementById('pflegezentrale-popup-titel')
      ?.innerText || '';

    const text = document
      .getElementById('pflegezentrale-popup-text')
      ?.innerText || '';

    const ansageText = (titel + '. ' + text)
      .replace(/\p{Extended_Pictographic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

    const ansage = new SpeechSynthesisUtterance(
      ansageText
    );

    ansage.lang = 'de-DE';
    ansage.rate = 0.93;

    const fertig = () => {
      button.classList.remove('aktiv');
    };

    ansage.onend = fertig;
    ansage.onerror = fertig;

    button.classList.add('aktiv');
    window.speechSynthesis.speak(ansage);
  }

  function pflegezentraleOeffnen() {
    popupSchliessen();
    window.location.href = 'pflegezentrale.html';
  }

  function starten() {
    cssEinbauen();
    popupEinbauen();
    footerButtonEinbauen();
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      starten,
      { once:true }
    );
  } else {
    starten();
  }

})();
