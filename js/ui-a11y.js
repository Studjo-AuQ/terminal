/* ══════════════════════════════════════════════════════
   ui-a11y.js – Tastatur- und Dialog-Barrierefreiheit
   Studjo Infoterminal | Evangelisches Johanneswerk

   Aufgaben:
   1. Popups / Overlays als echte Dialoge behandeln
      - role="dialog"
      - aria-modal="true"
      - Fokus beim Öffnen in den Dialog
      - Tab / Shift+Tab bleiben im Dialog
      - Escape schließt
      - Fokus geht danach zum Auslöser zurück
   2. Aufklapp-Bereiche tastaturbedienbar machen
      - FAQ-Kapitel
      - FAQ-Fragen
      - Übersicht-Kapitel
      - Neuigkeiten
      - aria-expanded / aria-controls
      - Enter / Leertaste
      - Pfeiltasten, Pos1, Ende

   Die vorhandene Optik und die vorhandenen onclick-Funktionen
   bleiben erhalten. Das Modul ergänzt Semantik und Tastatursteuerung.
   ══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  if (window.__studjoUiA11yAktiv) return;
  window.__studjoUiA11yAktiv = true;

  const FOKUS_SELEKTOR = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'iframe',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]'
  ].join(',');

  let aktiverDialog = null;
  let dialogAusloeser = null;
  let dialogWarOffen = new WeakMap();
  let idZaehler = 0;

  function istSichtbar(el) {
    if (!el) return false;

    const style = window.getComputedStyle(el);

    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      !el.hasAttribute('hidden')
    );
  }

  function neueId(prefix) {
    idZaehler += 1;
    return prefix + '-' + idZaehler;
  }

  function sichtbareFokuselemente(container) {
    return Array
      .from(
        container.querySelectorAll(
          FOKUS_SELEKTOR
        )
      )
      .filter(el => {
        if (!istSichtbar(el)) return false;

        const rect =
          el.getBoundingClientRect();

        return (
          rect.width > 0 ||
          rect.height > 0
        );
      });
  }


  /* ════════════════════════════════════════════════════
     DIALOGE / POPUPS
     ════════════════════════════════════════════════════ */

  function dialogNameSetzen(overlay) {
    if (
      overlay.hasAttribute(
        'aria-labelledby'
      ) ||
      overlay.hasAttribute(
        'aria-label'
      )
    ) {
      return;
    }

    const titel =
      overlay.querySelector(
        'h1, h2, h3'
      );

    if (titel) {
      if (!titel.id) {
        titel.id =
          neueId(
            'studjo-dialog-titel'
          );
      }

      overlay.setAttribute(
        'aria-labelledby',
        titel.id
      );

      return;
    }

    if (
      overlay.id ===
      'qr-overlay'
    ) {
      overlay.setAttribute(
        'aria-label',
        'QR-Code anzeigen'
      );

      return;
    }

    overlay.setAttribute(
      'aria-label',
      'Dialogfenster'
    );
  }

  function dialogSchliessen(
    overlay,
    fokusZurueck = true
  ) {
    if (!overlay) return;

    overlay.style.display =
      'none';

    overlay.setAttribute(
      'aria-hidden',
      'true'
    );

    if (
      window.speechSynthesis &&
      overlay.id === 'info-popup'
    ) {
      window.speechSynthesis.cancel();
    }

    if (
      aktiverDialog === overlay
    ) {
      aktiverDialog = null;
    }

    if (
      fokusZurueck &&
      dialogAusloeser &&
      document.contains(
        dialogAusloeser
      ) &&
      typeof dialogAusloeser.focus ===
        'function'
    ) {
      const ziel =
        dialogAusloeser;

      dialogAusloeser =
        null;

      window.setTimeout(
        () => ziel.focus(),
        0
      );

    } else if (fokusZurueck) {
      dialogAusloeser =
        null;
    }
  }

  function dialogGeoeffnet(
    overlay,
    ausloeser = null
  ) {
    if (
      !overlay ||
      !istSichtbar(overlay)
    ) {
      return;
    }

    if (
      aktiverDialog !== overlay
    ) {
      if (
        ausloeser &&
        ausloeser !== overlay
      ) {
        dialogAusloeser =
          ausloeser;
      } else if (
        document.activeElement &&
        !overlay.contains(
          document.activeElement
        )
      ) {
        dialogAusloeser =
          document.activeElement;
      }
    }

    aktiverDialog =
      overlay;

    overlay.setAttribute(
      'aria-hidden',
      'false'
    );

    const fokusElemente =
      sichtbareFokuselemente(
        overlay
      );

    const schliessen =
      fokusElemente.find(
        el =>
          /schließen|schliessen/i.test(
            el.getAttribute(
              'aria-label'
            ) || ''
          )
      );

    const ziel =
      schliessen ||
      fokusElemente[0] ||
      overlay;

    if (
      ziel === overlay
    ) {
      overlay.setAttribute(
        'tabindex',
        '-1'
      );
    }

    window.setTimeout(
      () => {
        if (
          istSichtbar(overlay) &&
          !overlay.contains(
            document.activeElement
          )
        ) {
          ziel.focus();
        }
      },
      0
    );
  }

  function dialogEinrichten(
    overlay
  ) {
    if (
      !overlay ||
      overlay.dataset
        .studjoDialogA11y === '1'
    ) {
      return;
    }

    overlay.dataset
      .studjoDialogA11y =
        '1';

    overlay.setAttribute(
      'role',
      'dialog'
    );

    overlay.setAttribute(
      'aria-modal',
      'true'
    );

    dialogNameSetzen(
      overlay
    );

    const offen =
      istSichtbar(
        overlay
      );

    overlay.setAttribute(
      'aria-hidden',
      offen
        ? 'false'
        : 'true'
    );

    dialogWarOffen.set(
      overlay,
      offen
    );

    /* Auslöser erkennen.
       Die vorhandenen Inline-onclicks bleiben unangetastet. */
    document
      .querySelectorAll(
        '[onclick]'
      )
      .forEach(trigger => {
        const code =
          trigger.getAttribute(
            'onclick'
          ) || '';

        if (
          !overlay.id ||
          !code.includes(
            overlay.id
          ) ||
          !/display\s*=\s*['"]flex['"]/i
            .test(code)
        ) {
          return;
        }

        if (
          trigger.dataset
            .studjoDialogTrigger ===
          overlay.id
        ) {
          return;
        }

        trigger.dataset
          .studjoDialogTrigger =
            overlay.id;

        trigger.setAttribute(
          'aria-haspopup',
          'dialog'
        );

        trigger.addEventListener(
          'click',
          () => {
            dialogAusloeser =
              trigger;

            window.setTimeout(
              () =>
                dialogGeoeffnet(
                  overlay,
                  trigger
                ),
              0
            );
          }
        );
      });

    /* Schließen-Buttons bekommen eine zusätzliche,
       zentrale Rückgabe des Fokus. */
    overlay
      .querySelectorAll(
        'button, [role="button"]'
      )
      .forEach(btn => {
        const label =
          btn.getAttribute(
            'aria-label'
          ) || '';

        const code =
          btn.getAttribute(
            'onclick'
          ) || '';

        if (
          /schließen|schliessen/i.test(
            label
          ) ||
          (
            overlay.id &&
            code.includes(
              overlay.id
            ) &&
            /display\s*=\s*['"]none['"]/i
              .test(code)
          )
        ) {
          btn.addEventListener(
            'click',
            () => {
              window.setTimeout(
                () => {
                  if (
                    !istSichtbar(
                      overlay
                    )
                  ) {
                    dialogSchliessen(
                      overlay,
                      true
                    );
                  }
                },
                0
              );
            }
          );
        }
      });

    /* Wenn das vorhandene onclick am dunklen Hintergrund
       den Dialog schließt, wird danach der Fokus zurückgegeben. */
    overlay.addEventListener(
      'click',
      e => {
        if (
          e.target !== overlay
        ) {
          return;
        }

        window.setTimeout(
          () => {
            if (
              !istSichtbar(
                overlay
              )
            ) {
              dialogSchliessen(
                overlay,
                true
              );
            }
          },
          0
        );
      }
    );

    /* Auch Öffnen/Schließen aus anderem JavaScript erkennen,
       z. B. beim Kalender-Popup. */
    const observer =
      new MutationObserver(
        () => {
          const jetztOffen =
            istSichtbar(
              overlay
            );

          const vorherOffen =
            dialogWarOffen.get(
              overlay
            );

          if (
            jetztOffen &&
            !vorherOffen
          ) {
            dialogGeoeffnet(
              overlay
            );
          }

          if (
            !jetztOffen &&
            vorherOffen
          ) {
            dialogSchliessen(
              overlay,
              true
            );
          }

          dialogWarOffen.set(
            overlay,
            jetztOffen
          );
        }
      );

    observer.observe(
      overlay,
      {
        attributes: true,
        attributeFilter: [
          'style',
          'class',
          'hidden'
        ]
      }
    );

    if (offen) {
      dialogGeoeffnet(
        overlay
      );
    }
  }

  function alleDialogeEinrichten() {
    const kandidaten =
      new Set([
        ...document.querySelectorAll(
          '#info-popup, #qr-overlay, #kalender-overlay, [role="dialog"][aria-modal="true"]'
        )
      ]);

    kandidaten.forEach(
      dialogEinrichten
    );
  }

  document.addEventListener(
    'keydown',
    e => {
      if (
        !aktiverDialog ||
        !istSichtbar(
          aktiverDialog
        )
      ) {
        return;
      }

      if (
        e.key === 'Escape'
      ) {
        e.preventDefault();
        e.stopPropagation();

        dialogSchliessen(
          aktiverDialog,
          true
        );

        return;
      }

      if (
        e.key !== 'Tab'
      ) {
        return;
      }

      const fokusElemente =
        sichtbareFokuselemente(
          aktiverDialog
        );

      if (
        fokusElemente.length === 0
      ) {
        e.preventDefault();

        aktiverDialog
          .setAttribute(
            'tabindex',
            '-1'
          );

        aktiverDialog
          .focus();

        return;
      }

      const erstes =
        fokusElemente[0];

      const letztes =
        fokusElemente[
          fokusElemente.length - 1
        ];

      if (
        e.shiftKey &&
        (
          document.activeElement ===
            erstes ||
          !aktiverDialog.contains(
            document.activeElement
          )
        )
      ) {
        e.preventDefault();
        letztes.focus();

      } else if (
        !e.shiftKey &&
        document.activeElement ===
          letztes
      ) {
        e.preventDefault();
        erstes.focus();
      }
    },
    true
  );


  /* ════════════════════════════════════════════════════
     ACCORDIONS / AUFKLAPP-BEREICHE
     ════════════════════════════════════════════════════ */

  function accordionStatus(
    trigger,
    container,
    panel
  ) {
    const offen =
      container.classList.contains(
        'offen'
      );

    trigger.setAttribute(
      'aria-expanded',
      offen
        ? 'true'
        : 'false'
    );

    if (panel) {
      panel.setAttribute(
        'aria-hidden',
        offen
          ? 'false'
          : 'true'
      );
    }
  }

  function keyboardNavigation(
    trigger,
    gruppe
  ) {
    trigger.addEventListener(
      'keydown',
      e => {
        if (
          e.key === 'Enter' ||
          e.key === ' '
        ) {
          e.preventDefault();
          trigger.click();
          return;
        }

        const alle =
          Array.from(
            gruppe()
          );

        const index =
          alle.indexOf(
            trigger
          );

        if (
          index < 0 ||
          alle.length < 2
        ) {
          return;
        }

        let ziel = null;

        if (
          e.key === 'ArrowDown' ||
          e.key === 'ArrowRight'
        ) {
          ziel =
            alle[
              (index + 1) %
              alle.length
            ];

        } else if (
          e.key === 'ArrowUp' ||
          e.key === 'ArrowLeft'
        ) {
          ziel =
            alle[
              (
                index - 1 +
                alle.length
              ) %
              alle.length
            ];

        } else if (
          e.key === 'Home'
        ) {
          ziel =
            alle[0];

        } else if (
          e.key === 'End'
        ) {
          ziel =
            alle[
              alle.length - 1
            ];
        }

        if (ziel) {
          e.preventDefault();
          ziel.focus();
        }
      }
    );
  }

  function klassischesAccordionEinrichten(
    trigger,
    container,
    panel,
    gruppe
  ) {
    if (
      trigger.dataset
        .studjoAccordionA11y ===
      '1'
    ) {
      return;
    }

    trigger.dataset
      .studjoAccordionA11y =
        '1';

    trigger.setAttribute(
      'role',
      'button'
    );

    trigger.setAttribute(
      'tabindex',
      '0'
    );

    if (!panel.id) {
      panel.id =
        neueId(
          'studjo-accordion-panel'
        );
    }

    trigger.setAttribute(
      'aria-controls',
      panel.id
    );

    accordionStatus(
      trigger,
      container,
      panel
    );

    keyboardNavigation(
      trigger,
      gruppe
    );

    const observer =
      new MutationObserver(
        () =>
          accordionStatus(
            trigger,
            container,
            panel
          )
      );

    observer.observe(
      container,
      {
        attributes: true,
        attributeFilter: [
          'class'
        ]
      }
    );
  }

  function faqUndKapitelEinrichten() {
    /* Kapitel-Köpfe auf FAQ und Übersicht */
    document
      .querySelectorAll(
        '.kapitel-kachel > .kachel-kopf'
      )
      .forEach(trigger => {
        const container =
          trigger.closest(
            '.kapitel-kachel'
          );

        const panel =
          container &&
          container.querySelector(
            ':scope > .kachel-inhalt'
          );

        if (
          !container ||
          !panel
        ) {
          return;
        }

        klassischesAccordionEinrichten(
          trigger,
          container,
          panel,
          () =>
            Array.from(
              document.querySelectorAll(
                '.kapitel-kachel > .kachel-kopf'
              )
            )
        );
      });

    /* Einzelne FAQ-Fragen */
    document
      .querySelectorAll(
        '.faq-karte > .faq-frage'
      )
      .forEach(trigger => {
        const container =
          trigger.closest(
            '.faq-karte'
          );

        const panel =
          container &&
          container.querySelector(
            ':scope > .faq-antwort'
          );

        if (
          !container ||
          !panel
        ) {
          return;
        }

        klassischesAccordionEinrichten(
          trigger,
          container,
          panel,
          () => {
            const bereich =
              trigger.closest(
                '.kachel-inhalt'
              );

            return bereich
              ? Array.from(
                  bereich.querySelectorAll(
                    '.faq-karte > .faq-frage'
                  )
                )
              : [];
          }
        );
      });
  }

  function newsEinrichten() {
    document
      .querySelectorAll(
        '.news-card'
      )
      .forEach(karte => {
        if (
          karte.dataset
            .studjoNewsA11y === '1'
        ) {
          return;
        }

        const kopf =
          karte.querySelector(
            ':scope > .news-kopf'
          );

        const trigger =
          kopf &&
          kopf.querySelector(
            '.news-content'
          );

        const panel =
          karte.querySelector(
            ':scope > .news-mehr'
          );

        if (
          !kopf ||
          !trigger ||
          !panel
        ) {
          return;
        }

        karte.dataset
          .studjoNewsA11y =
            '1';

        /* Nicht den kompletten news-kopf als Button deklarieren:
           Darin steckt bereits der separate Vorlese-Button.
           Der Textbereich wird daher zum semantischen Aufklapp-Auslöser. */
        trigger.setAttribute(
          'role',
          'button'
        );

        trigger.setAttribute(
          'tabindex',
          '0'
        );

        if (!panel.id) {
          panel.id =
            neueId(
              'studjo-news-panel'
            );
        }

        trigger.setAttribute(
          'aria-controls',
          panel.id
        );

        const status = () => {
          const offen =
            karte.classList.contains(
              'offen'
            );

          trigger.setAttribute(
            'aria-expanded',
            offen
              ? 'true'
              : 'false'
          );

          panel.setAttribute(
            'aria-hidden',
            offen
              ? 'false'
              : 'true'
          );
        };

        status();

        trigger.addEventListener(
          'click',
          e => {
            /* Klick auf den Textbereich darf weiter zum vorhandenen
               onclick des news-kopfes blubbern. */
          }
        );

        trigger.addEventListener(
          'keydown',
          e => {
            if (
              e.key === 'Enter' ||
              e.key === ' '
            ) {
              e.preventDefault();

              if (
                typeof window.toggleNews ===
                'function'
              ) {
                window.toggleNews(
                  kopf
                );
              } else {
                kopf.click();
              }

              return;
            }

            const alle =
              Array.from(
                document.querySelectorAll(
                  '.news-card .news-content'
                )
              );

            const index =
              alle.indexOf(
                trigger
              );

            let ziel = null;

            if (
              e.key ===
                'ArrowDown' ||
              e.key ===
                'ArrowRight'
            ) {
              ziel =
                alle[
                  (index + 1) %
                  alle.length
                ];

            } else if (
              e.key ===
                'ArrowUp' ||
              e.key ===
                'ArrowLeft'
            ) {
              ziel =
                alle[
                  (
                    index - 1 +
                    alle.length
                  ) %
                  alle.length
                ];

            } else if (
              e.key === 'Home'
            ) {
              ziel =
                alle[0];

            } else if (
              e.key === 'End'
            ) {
              ziel =
                alle[
                  alle.length - 1
                ];
            }

            if (ziel) {
              e.preventDefault();
              ziel.focus();
            }
          }
        );

        const observer =
          new MutationObserver(
            status
          );

        observer.observe(
          karte,
          {
            attributes: true,
            attributeFilter: [
              'class'
            ]
          }
        );
      });
  }

  function accordionsEinrichten() {
    faqUndKapitelEinrichten();
    newsEinrichten();
  }



  /* ════════════════════════════════════════════════════
     INTERNE CONSENSE-LINKS
     Erst Hinweis zeigen, danach auf Wunsch Originalziel öffnen.
     ════════════════════════════════════════════════════ */

  const CONSENSE_HOST =
    '001sdbfevm-660.johanneswerk.int';

  let consenseZielUrl = '';
  let consenseZielLink = null;

  function istConsenseLink(link) {
    if (
      !link ||
      link.tagName !== 'A' ||
      !link.href
    ) {
      return false;
    }

    try {
      const url =
        new URL(
          link.href,
          window.location.href
        );

      return (
        url.hostname
          .toLowerCase() ===
        CONSENSE_HOST
      );

    } catch (e) {
      return false;
    }
  }

  function consenseDialogErzeugen() {
    let dialog =
      document.getElementById(
        'consense-hinweis-dialog'
      );

    if (dialog) {
      return dialog;
    }

    document.body.insertAdjacentHTML(
      'beforeend',
      `
<div id="consense-hinweis-dialog"
     role="dialog"
     aria-modal="true"
     aria-labelledby="consense-hinweis-titel"
     aria-describedby="consense-hinweis-text"
     aria-hidden="true"
     style="
       display:none;
       position:fixed;
       inset:0;
       z-index:2600;
       background:rgba(0,0,0,.62);
       align-items:center;
       justify-content:center;
       padding:20px;
     ">

  <div data-dialog-inhalt
       style="
         width:min(520px,100%);
         background:#fff;
         color:#0f2f37;
         border-radius:18px;
         box-shadow:0 12px 42px rgba(0,0,0,.38);
         padding:30px 26px 24px;
         position:relative;
         text-align:left;
       ">

    <button type="button"
            id="consense-hinweis-x"
            aria-label="Schließen"
            style="
              position:absolute;
              top:10px;
              right:10px;
              width:36px;
              height:36px;
              border:0;
              border-radius:50%;
              background:#f1f1f1;
              color:#0f2f37;
              font-size:1.15rem;
              cursor:pointer;
            ">
      ✕
    </button>

    <div aria-hidden="true"
         style="
           font-size:3rem;
           line-height:1;
           margin:0 0 12px;
         ">
      🔒
    </div>

    <h2 id="consense-hinweis-titel"
        style="
          margin:0 44px 16px 0;
          color:#b61f29;
          font-size:1.45rem;
          line-height:1.25;
        ">
      Interne Seite
    </h2>

    <div id="consense-hinweis-text"
         style="
           font-size:1.08rem;
           line-height:1.7;
         ">

      <p style="margin:0 0 10px;">
        Diese Seite ist bei <strong>ConSense</strong>.
      </p>

      <p style="margin:0 0 10px;">
        Du brauchst Zugang zu ConSense.
      </p>

      <p style="margin:0 0 10px;">
        Bei Studjo kannst du die Seite am PC öffnen.
      </p>

      <p style="margin:0 0 20px;">
        Mit einem privaten Handy geht es oft nicht.
      </p>
    </div>

    <div style="
           display:flex;
           flex-wrap:wrap;
           gap:10px;
           margin-top:4px;
         ">

      <button type="button"
              id="consense-hinweis-oeffnen"
              style="
                flex:1 1 210px;
                min-height:52px;
                border:0;
                border-radius:12px;
                background:#b61f29;
                color:#fff;
                font:inherit;
                font-size:1rem;
                font-weight:900;
                cursor:pointer;
                padding:12px 18px;
              ">
        ConSense öffnen
      </button>

      <button type="button"
              id="consense-hinweis-zurueck"
              style="
                flex:1 1 130px;
                min-height:52px;
                border:2px solid #b61f29;
                border-radius:12px;
                background:#fff;
                color:#b61f29;
                font:inherit;
                font-size:1rem;
                font-weight:900;
                cursor:pointer;
                padding:12px 18px;
              ">
        Zurück
      </button>

    </div>

  </div>
</div>`
    );

    dialog =
      document.getElementById(
        'consense-hinweis-dialog'
      );

    const inhalt =
      dialog.querySelector(
        '[data-dialog-inhalt]'
      );

    inhalt.addEventListener(
      'click',
      e => e.stopPropagation()
    );

    document.getElementById(
      'consense-hinweis-x'
    ).addEventListener(
      'click',
      () => {
        dialogSchliessen(
          dialog,
          true
        );
      }
    );

    document.getElementById(
      'consense-hinweis-zurueck'
    ).addEventListener(
      'click',
      () => {
        dialogSchliessen(
          dialog,
          true
        );
      }
    );

    document.getElementById(
      'consense-hinweis-oeffnen'
    ).addEventListener(
      'click',
      () => {
        const ziel =
          consenseZielUrl;

        dialogSchliessen(
          dialog,
          false
        );

        consenseZielUrl =
          '';

        if (!ziel) {
          const rueckgabe =
            consenseZielLink;

          consenseZielLink =
            null;

          if (
            rueckgabe &&
            document.contains(
              rueckgabe
            )
          ) {
            rueckgabe.focus();
          }

          return;
        }

        const neuesFenster =
          window.open(
            ziel,
            '_blank',
            'noopener,noreferrer'
          );

        if (neuesFenster) {
          try {
            neuesFenster.opener =
              null;
          } catch (e) {}
        }

        const rueckgabe =
          consenseZielLink;

        consenseZielLink =
          null;

        if (
          rueckgabe &&
          document.contains(
            rueckgabe
          )
        ) {
          window.setTimeout(
            () =>
              rueckgabe.focus(),
            0
          );
        }
      }
    );

    dialog.addEventListener(
      'click',
      e => {
        if (
          e.target === dialog
        ) {
          dialogSchliessen(
            dialog,
            true
          );
        }
      }
    );

    dialogEinrichten(
      dialog
    );

    return dialog;
  }

  function consenseHinweisOeffnen(
    link
  ) {
    const dialog =
      consenseDialogErzeugen();

    consenseZielUrl =
      link.href;

    consenseZielLink =
      link;

    dialogAusloeser =
      link;

    dialog.style.display =
      'flex';

    dialog.setAttribute(
      'aria-hidden',
      'false'
    );

    dialogGeoeffnet(
      dialog,
      link
    );

    window.setTimeout(
      () => {
        const btn =
          document.getElementById(
            'consense-hinweis-oeffnen'
          );

        if (btn) {
          btn.focus();
        }
      },
      0
    );
  }

  function consenseLinksEinrichten() {
    document
      .querySelectorAll(
        'a[href]'
      )
      .forEach(link => {
        if (
          !istConsenseLink(link) ||
          link.dataset
            .studjoConsenseHinweis ===
          '1'
        ) {
          return;
        }

        link.dataset
          .studjoConsenseHinweis =
            '1';

        link.setAttribute(
          'aria-haspopup',
          'dialog'
        );

        link.addEventListener(
          'click',
          e => {
            if (
              e.defaultPrevented
            ) {
              return;
            }

            e.preventDefault();

            consenseHinweisOeffnen(
              link
            );
          }
        );
      });
  }

  /* ════════════════════════════════════════════════════
     DYNAMISCHE ELEMENTE
     Kalender-Popup wird z. B. erst beim Klick erzeugt.
     ════════════════════════════════════════════════════ */

  let nachladeTimer = null;

  const domObserver =
    new MutationObserver(
      () => {
        clearTimeout(
          nachladeTimer
        );

        nachladeTimer =
          window.setTimeout(
            () => {
              alleDialogeEinrichten();
              accordionsEinrichten();
              consenseLinksEinrichten();
            },
            30
          );
      }
    );

  function starten() {
    alleDialogeEinrichten();
    accordionsEinrichten();
    consenseLinksEinrichten();

    domObserver.observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );
  }

  if (
    document.readyState ===
    'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      starten,
      { once: true }
    );
  } else {
    starten();
  }

})();
