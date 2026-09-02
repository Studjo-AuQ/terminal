/* ══════════════════════════════════════════════════════
   speiseplan-ansicht.js
   Studjo Terminal | Evangelisches Johanneswerk

   Rendert das Speiseplan-PDF (2 Seiten: 1 = Tabelle mit
   Text, 2 = Essensbilder) per PDF.js auf einen Canvas.
   Auf Seite 1 wird die Zeile des heutigen Wochentags anhand
   der erkannten Tabellen-Rasterlinien farbig umrandet – ganz
   ohne Texterkennung, da die Wochentage immer in fester
   Reihenfolge Montag–Freitag erscheinen.
   ══════════════════════════════════════════════════════ */

import * as pdfjsLib from './pdfjs/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdfjs/pdf.worker.min.mjs';

const ORDNER = 'speiseplaene/';
const TITEL  = ['Aktuelle Woche', 'Nächste Woche', 'In 2 Wochen'];
const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];

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

/* Mehrere übliche Schreibweisen probieren, falls beim manuellen
   Hochladen die Groß-/Kleinschreibung oder die führende Null beim
   Dateinamen abweicht. */
function kandidatenFuer(offsetWochen) {
    const datum = new Date();
    datum.setDate(datum.getDate() + offsetWochen * 7);
    const { jahr, woche } = getISOWocheJahr(datum);
    const woche2 = String(woche).padStart(2, '0');
    return [
        ORDNER + 'speiseplan_' + jahr + '-KW' + woche2 + '.pdf',
        ORDNER + 'Speiseplan_' + jahr + '-KW' + woche2 + '.pdf',
        ORDNER + 'speiseplan_' + jahr + '-KW' + woche + '.pdf',
        ORDNER + 'Speiseplan_' + jahr + '-KW' + woche + '.pdf',
    ];
}

const params = new URLSearchParams(window.location.search);
let offset = parseInt(params.get('woche'), 10);
if (isNaN(offset) || offset < 0 || offset > 2) offset = 0;

document.getElementById('sp-titel').textContent =
    '📄 Speiseplan – ' + (TITEL[offset] || 'Aktuelle Woche');

const kandidaten   = kandidatenFuer(offset);
const ladeEl      = document.getElementById('sp-lade');
const fehlerEl    = document.getElementById('sp-fehler');
const canvasWrap  = document.getElementById('sp-canvas-wrap');
const canvas      = document.getElementById('sp-canvas');
const rahmenEl    = document.getElementById('sp-tages-rahmen');
const srHinweisEl = document.getElementById('sp-sr-hinweis');
const navEl       = document.getElementById('sp-seiten-nav');
const btnPrev     = document.getElementById('sp-btn-prev');
const btnNext     = document.getElementById('sp-btn-next');
const seitenInfo  = document.getElementById('sp-seiten-info');

let pdfDokument   = null;
let aktuelleSeite = 1;

async function renderSeite(nummer) {
    const seite = await pdfDokument.getPage(nummer);
    const basisViewport = seite.getViewport({ scale: 1 });

    // An verfügbare Breite anpassen, max. 1400px für gute Lesbarkeit
    const verfuegbar = Math.min(window.innerWidth - 40, 1400);
    const skalierung = verfuegbar / basisViewport.width;
    const viewport   = seite.getViewport({ scale: skalierung });

    canvas.width  = viewport.width;
    canvas.height = viewport.height;

    await seite.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

    rahmenEl.hidden = true;
    srHinweisEl.textContent = '';

    if (nummer === 1) {
        // Die Umrandung ist ein Zusatz-Feature. Falls die Erkennung aus
        // irgendeinem Grund fehlschlägt, soll der Speiseplan trotzdem
        // ganz normal angezeigt werden – nur eben ohne Umrandung.
        try {
            markiereHeutigenTag();
        } catch (fehler) {
            console.warn('Tages-Umrandung konnte nicht berechnet werden (Speiseplan wird trotzdem angezeigt):', fehler);
        }
    }

    aktuelleSeite = nummer;
    seitenInfo.textContent = 'Seite ' + nummer + ' von ' + pdfDokument.numPages;
    btnPrev.disabled = nummer <= 1;
    btnNext.disabled = nummer >= pdfDokument.numPages;
}

function markiereHeutigenTag() {
    const wochentagIndex = window.SpeiseplanErkennung.heutigerWochentagIndex(); // 0=Mo…6=So
    if (wochentagIndex > 4) return; // Wochenende: keine Zeile zum Markieren

    const linienY = window.SpeiseplanErkennung.findeLinien(canvas, 'horizontal');
    // Erwartet: [oberer Rand, Ende Kopfzeile, Mo/Di-Grenze, Di/Mi-Grenze, ...,
    //            unterer Rand]. Die 5 Tagesbereiche liegen zwischen den
    // Linien ab Index 1 (nach der Kopfzeile).
    if (linienY.length < 7) return; // Tabellenlayout nicht wie erwartet – lieber nichts markieren

    const startY = linienY[1 + wochentagIndex];
    const endeY  = linienY[2 + wochentagIndex];
    if (startY === undefined || endeY === undefined) return;

    const linienX = window.SpeiseplanErkennung.findeLinien(canvas, 'vertikal');
    const startX = linienX.length ? linienX[0] : 0;
    const endeX  = linienX.length ? linienX[linienX.length - 1] : canvas.width;

    const wrapRect   = canvasWrap.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const offsetLinks = canvasRect.left - wrapRect.left + canvasWrap.scrollLeft;
    const offsetOben  = canvasRect.top  - wrapRect.top  + canvasWrap.scrollTop;

    // Skalierung: Canvas-Pixel -> tatsächlich dargestellte Größe (CSS)
    const skalaX = canvasRect.width  / canvas.width;
    const skalaY = canvasRect.height / canvas.height;

    rahmenEl.style.left   = (offsetLinks + startX * skalaX - 4) + 'px';
    rahmenEl.style.top    = (offsetOben  + startY * skalaY - 4) + 'px';
    rahmenEl.style.width  = ((endeX - startX) * skalaX + 8) + 'px';
    rahmenEl.style.height = ((endeY - startY) * skalaY + 8) + 'px';
    rahmenEl.hidden = false;

    srHinweisEl.textContent =
        'Heute ist ' + WOCHENTAGE[wochentagIndex] + '. ' +
        'Die entsprechende Zeile ist auf dem Speiseplan grün umrandet.';
}

function wechselSeite(richtung) {
    const ziel = aktuelleSeite + richtung;
    if (ziel >= 1 && ziel <= pdfDokument.numPages) renderSeite(ziel);
}
btnPrev.addEventListener('click', () => wechselSeite(-1));
btnNext.addEventListener('click', () => wechselSeite(1));

// Bei Fenstergrößenänderung (z. B. Tablet-Drehung) neu rendern,
// damit die Umrandung weiterhin exakt sitzt
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (pdfDokument) renderSeite(aktuelleSeite); }, 300);
});

(async function start() {
    let stufe = 'Datei suchen';
    try {
        const pfad = await window.SpeiseplanErkennung.findeDatei(kandidaten);

        if (!pfad) {
            ladeEl.hidden = true;
            fehlerEl.querySelector('p').innerHTML =
                'Dieser Speiseplan ist noch nicht veröffentlicht.<br>' +
                '<small>Erwartete Datei: ' + kandidaten[0] + '</small>';
            fehlerEl.hidden = false;
            return;
        }

        stufe = 'PDF laden';
        pdfDokument = await pdfjsLib.getDocument(pfad).promise;

        ladeEl.hidden = true;
        canvasWrap.hidden = false;
        if (pdfDokument.numPages > 1) navEl.hidden = false;

        stufe = 'Seite anzeigen';
        await renderSeite(1);

    } catch (fehler) {
        console.error('Fehler beim Anzeigen des Speiseplans (Schritt: ' + stufe + '):', fehler);
        ladeEl.hidden = true;
        canvasWrap.hidden = true;
        fehlerEl.querySelector('p').textContent =
            'Der Speiseplan konnte nicht angezeigt werden. ' +
            '(Technischer Fehler bei „' + stufe + '“: ' + (fehler && fehler.message ? fehler.message : fehler) + ')';
        fehlerEl.hidden = false;
    }
})();
