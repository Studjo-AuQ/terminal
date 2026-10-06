/* ══════════════════════════════════════════════════════
   wochenmotto.js
   Studjo Terminal | Evangelisches Johanneswerk

   - lädt die Inhalte aus wochenmottos.json
   - wechselt automatisch jede Woche
   - nutzt 100 Mottos fortlaufend und beginnt erst danach neu
   - KW 1/2026 = Motto 1
   - die Reihenfolge läuft über Jahreswechsel weiter

   Test:
     ?motto=75
     ?nr=75
   Aus Kompatibilitätsgründen funktioniert auch weiterhin:
     ?kw=10
   ══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const JSON_DATEI = 'wochenmottos.json';

  /* Montag der ISO-KW 1/2026.
     Dadurch bleiben die bisherigen Mottos 1–50 zunächst in derselben
     Wochen-Reihenfolge. Danach folgen 51–100. */
  const START_MONTAG_UTC = Date.UTC(2025, 11, 29);
  const WOCHE_MS = 7 * 24 * 60 * 60 * 1000;

  const THEMEN_KLASSEN = {
    'Gut arbeiten': 'wm-thema-arbeit',
    'Pünktlich sein': 'wm-thema-zeit',
    'Helfen': 'wm-thema-helfen',
    'Zusammen arbeiten': 'wm-thema-team',
    'Lernen und üben': 'wm-thema-lernen',
    'Gut zuhören': 'wm-thema-zuhoeren',
    'Freundlich sein': 'wm-thema-freundlich',
    'Sorgfältig arbeiten': 'wm-thema-sorgfalt',
    'Aufeinander achten': 'wm-thema-achten',
    'Dranbleiben und Mut haben': 'wm-thema-mut',
    'Sich mitteilen': 'wm-thema-sprechen',
    'Ordnung halten': 'wm-thema-ordnung',
    'Sicher arbeiten': 'wm-thema-sicher',
    'Pausen machen': 'wm-thema-pause',
    'Fair sein': 'wm-thema-fair'
  };

  function getISOWeek(datum) {
    const d = new Date(Date.UTC(
      datum.getFullYear(),
      datum.getMonth(),
      datum.getDate()
    ));

    const wochentag = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - wochentag + 3);

    const jahresStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const startWochentag = (jahresStart.getUTCDay() + 6) % 7;
    jahresStart.setUTCDate(
      jahresStart.getUTCDate() - startWochentag + 3
    );

    return 1 + Math.round((d - jahresStart) / WOCHE_MS);
  }

  function montagDerWocheUTC(datum) {
    const d = new Date(Date.UTC(
      datum.getFullYear(),
      datum.getMonth(),
      datum.getDate()
    ));

    const tag = d.getUTCDay();
    const bisMontag = tag === 0 ? -6 : 1 - tag;
    d.setUTCDate(d.getUTCDate() + bisMontag);

    return Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate()
    );
  }

  function positiveModulo(zahl, teiler) {
    return ((zahl % teiler) + teiler) % teiler;
  }

  function mottoNummerFuerDatum(datum, anzahlMottos) {
    const montag = montagDerWocheUTC(datum);
    const wochenSeitStart = Math.round(
      (montag - START_MONTAG_UTC) / WOCHE_MS
    );

    return positiveModulo(wochenSeitStart, anzahlMottos) + 1;
  }

  function getTestNummer(anzahlMottos) {
    const params = new URLSearchParams(window.location.search);

    const moeglicheParameter = [
      params.get('motto'),
      params.get('nr'),
      params.get('kw')
    ];

    for (const wertText of moeglicheParameter) {
      const wert = parseInt(wertText, 10);
      if (
        Number.isInteger(wert) &&
        wert >= 1 &&
        wert <= anzahlMottos
      ) {
        return wert;
      }
    }

    return null;
  }

  function zeigeFehler(text) {
    const box = document.getElementById('wm-box');
    if (!box) return;

    box.innerHTML =
      '<p class="wm-fehler">' +
      (text || 'Das Wochenmotto kann gerade nicht geladen werden.') +
      '</p>';
  }

  function zeigeMotto(eintrag, isoWoche, mottoNr, anzahlMottos, istTest) {
    if (!eintrag) {
      zeigeFehler();
      return;
    }

    const box = document.getElementById('wm-box');
    const kwEl = document.getElementById('wm-kw');
    const nummerEl = document.getElementById('wm-nummer');
    const emojiEl = document.getElementById('wm-emoji');
    const themaEl = document.getElementById('wm-thema');
    const mottoEl = document.getElementById('wm-motto');
    const toggleEl = document.getElementById('wm-toggle');
    const erklaerungEl = document.getElementById('wm-erklaerung');
    const listeEl = document.getElementById('wm-erklaerung-liste');

    const themenKlasse =
      THEMEN_KLASSEN[eintrag.thema] || 'wm-thema-standard';

    box.className = 'wm-box ' + themenKlasse;

    kwEl.textContent = istTest
      ? 'Test-Ansicht'
      : 'Diese Woche: KW ' + isoWoche;

    nummerEl.textContent =
      'Motto ' + mottoNr + ' von ' + anzahlMottos;

    emojiEl.textContent = eintrag.emoji || '🌟';
    themaEl.textContent = eintrag.thema;
    mottoEl.textContent = eintrag.motto;

    listeEl.innerHTML = '';

    (eintrag.erklaerungen || []).forEach(function (satz, index) {
      const li = document.createElement('li');

      const nummer = document.createElement('span');
      nummer.className = 'wm-erklaerung-nummer';
      nummer.setAttribute('aria-hidden', 'true');
      nummer.textContent = String(index + 1);

      const text = document.createElement('span');
      text.textContent = satz;

      li.appendChild(nummer);
      li.appendChild(text);
      listeEl.appendChild(li);
    });

    toggleEl.setAttribute('aria-expanded', 'false');
    erklaerungEl.hidden = true;
    toggleEl.querySelector('.wm-pfeil').textContent = '▼';

    toggleEl.addEventListener('click', function () {
      const offen =
        toggleEl.getAttribute('aria-expanded') === 'true';

      toggleEl.setAttribute(
        'aria-expanded',
        String(!offen)
      );

      erklaerungEl.hidden = offen;

      toggleEl.querySelector('.wm-pfeil').textContent =
        offen ? '▼' : '▲';
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    fetch(JSON_DATEI)
      .then(function (antwort) {
        if (!antwort.ok) {
          throw new Error('HTTP ' + antwort.status);
        }
        return antwort.json();
      })
      .then(function (daten) {
        const liste = Array.isArray(daten.wochenmottos)
          ? daten.wochenmottos
          : [];

        if (liste.length === 0) {
          throw new Error('Keine Mottos in der JSON-Datei.');
        }

        const anzahlMottos = liste.length;
        const heute = new Date();
        const isoWoche = getISOWeek(heute);
        const testNummer = getTestNummer(anzahlMottos);

        const mottoNr = testNummer !== null
          ? testNummer
          : mottoNummerFuerDatum(heute, anzahlMottos);

        const eintrag = liste.find(function (m) {
          return Number(m.woche) === mottoNr;
        });

        zeigeMotto(
          eintrag,
          isoWoche,
          mottoNr,
          anzahlMottos,
          testNummer !== null
        );
      })
      .catch(function (fehler) {
        console.error(
          'Wochenmotto konnte nicht geladen werden:',
          fehler
        );

        zeigeFehler();
      });
  });

})();
