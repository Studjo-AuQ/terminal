/* ══════════════════════════════════════════════════════
   speiseplan-ansicht.js
   Studjo Terminal | Evangelisches Johanneswerk

   Liest den Parameter ?woche=0|1|2 aus der URL
   (0 = aktuelle Woche, 1 = nächste, 2 = übernächste),
   berechnet daraus den erwarteten PDF-Dateinamen und
   zeigt ihn im Iframe an. Existiert die Datei noch nicht,
   erscheint eine freundliche Hinweismeldung statt eines
   defekten Iframes.
   ══════════════════════════════════════════════════════ */

(function () {

    const ORDNER = 'speiseplaene/';
    const TITEL  = ['Aktuelle Woche', 'Nächste Woche', 'In 2 Wochen'];

    function getISOWocheJahr(datum) {
        const d = new Date(Date.UTC(
            datum.getFullYear(), datum.getMonth(), datum.getDate()
        ));
        const wochentag = (d.getUTCDay() + 6) % 7;
        d.setUTCDate(d.getUTCDate() - wochentag + 3);
        const isoJahr = d.getUTCFullYear();

        const jahresStart = new Date(Date.UTC(isoJahr, 0, 4));
        const startWochentag = (jahresStart.getUTCDay() + 6) % 7;
        jahresStart.setUTCDate(jahresStart.getUTCDate() - startWochentag + 3);

        const wocheMs = 7 * 24 * 60 * 60 * 1000;
        const woche = 1 + Math.round((d - jahresStart) / wocheMs);
        return { jahr: isoJahr, woche: woche };
    }

    function dateiname(offsetWochen) {
        const datum = new Date();
        datum.setDate(datum.getDate() + offsetWochen * 7);
        const { jahr, woche } = getISOWocheJahr(datum);
        return ORDNER + 'speiseplan_' + jahr + '-KW' +
            String(woche).padStart(2, '0') + '.pdf';
    }

    const params = new URLSearchParams(window.location.search);
    let offset = parseInt(params.get('woche'), 10);
    if (isNaN(offset) || offset < 0 || offset > 2) offset = 0;

    document.getElementById('sp-titel').textContent =
        '📄 Speiseplan – ' + (TITEL[offset] || 'Aktuelle Woche');

    const pfad     = dateiname(offset);
    const iframeEl = document.getElementById('sp-iframe');
    const fehlerEl = document.getElementById('sp-fehler');

    fetch(pfad, { method: 'HEAD' })
        .then(antwort => {
            if (!antwort.ok) throw new Error('nicht gefunden');
            // #toolbar=0 schaltet die browser-eigene PDF-Werkzeugleiste
            // (Download, Drucken, …) ab – wichtig im Kiosk-Modus.
            iframeEl.src = pfad + '#toolbar=0';
            iframeEl.hidden = false;
        })
        .catch(() => {
            fehlerEl.hidden = false;
        });

})();
