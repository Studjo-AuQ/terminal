/* ══════════════════════════════════════════════════════
   speiseplan-ansicht.js  (Version 2 – in sich geschlossen)
   Studjo Terminal | Evangelisches Johanneswerk

   WICHTIG: Diese Datei ist bewusst komplett eigenständig und
   hat KEINE Abhängigkeit mehr zu speiseplan-erkennung.js.
   Grund: Bei mehreren einzeln hochgeladenen Dateien kann es
   passieren, dass eine alte Version einer Datei liegen bleibt,
   während eine andere Datei schon eine neue Funktion daraus
   erwartet ("... is not a function"). Mit nur einer Datei kann
   das nicht mehr passieren.

   Der farbige Rahmen um den heutigen Tag wird außerdem nicht
   mehr als separates, absolut positioniertes Element über dem
   Canvas gezeichnet (das ist fehleranfällig: CSS-Skalierung,
   Scroll-Position, getBoundingClientRect – jede Kleinigkeit
   kann die Position verschieben). Stattdessen wird der Rahmen
   direkt in denselben Canvas gezeichnet, in dem auch das PDF
   liegt – gleiches Koordinatensystem, keine Umrechnung nötig.
   ══════════════════════════════════════════════════════ */

import * as pdfjsLib from './pdfjs/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdfjs/pdf.worker.min.mjs';

const ORDNER = 'speiseplaene/';
const TITEL  = ['Aktuelle Woche', 'Nächste Woche', 'In 2 Wochen'];
const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];

function getISOWocheJahr(datum) {
    const d = new Date(Date.UTC(datum.getFullYear(), datum.getMonth(), datum.getDate()));
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

async function findeDatei(kandidaten) {
    for (const pfad of kandidaten) {
        try {
            const antwort = await fetch(pfad, { method: 'HEAD' });
            if (antwort.ok) return pfad;
        } catch (e) { /* nächsten Kandidaten versuchen */ }
    }
    return null;
}

/* Findet dunkle, durchgehende horizontale Linien (Tabellenraster)
   direkt im übergebenen Canvas. */
function findeHorizontaleLinien(canvas, schwelle = 0.5, dunkelWert = 130) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const bild = ctx.getImageData(0, 0, width, height).data;

    const kandidaten = [];
    for (let y = 0; y < height; y++) {
        let dunkleAnzahl = 0;
        for (let x = 0; x < width; x += 2) {
            const idx = (y * width + x) * 4;
            const grau = (bild[idx] + bild[idx + 1] + bild[idx + 2]) / 3;
            if (grau < dunkelWert) dunkleAnzahl++;
        }
        if (dunkleAnzahl > (width / 2) * schwelle) kandidaten.push(y);
    }

    const gruppen = [];
    kandidaten.forEach(pos => {
        const letzte = gruppen[gruppen.length - 1];
        if (letzte && pos - letzte[letzte.length - 1] <= 10) letzte.push(pos);
        else gruppen.push([pos]);
    });
    return gruppen.map(g => Math.round(g.reduce((a, b) => a + b, 0) / g.length));
}

function heutigerWochentagIndex() {
    const tag = new Date().getDay(); // 0=Sonntag … 6=Samstag
    return (tag + 6) % 7; // 0=Montag … 6=Sonntag
}

const params = new URLSearchParams(window.location.search);
let offset = parseInt(params.get('woche'), 10);
if (isNaN(offset) || offset < 0 || offset > 2) offset = 0;

document.getElementById('sp-titel').textContent =
    '📄 Speiseplan – ' + (TITEL[offset] || 'Aktuelle Woche');

const kandidaten   = kandidatenFuer(offset);
const ladeEl       = document.getElementById('sp-lade');
const fehlerEl     = document.getElementById('sp-fehler');
const canvasWrap   = document.getElementById('sp-canvas-wrap');
const canvas       = document.getElementById('sp-canvas');
const srHinweisEl  = document.getElementById('sp-sr-hinweis');
const navEl        = document.getElementById('sp-seiten-nav');
const btnPrev      = document.getElementById('sp-btn-prev');
const btnNext      = document.getElementById('sp-btn-next');
const seitenInfo   = document.getElementById('sp-seiten-info');

let pdfDokument   = null;
let aktuelleSeite = 1;
let seite1Original = null; // Referenz auf die geladene Seite 1 für die Rahmen-Erkennung

async function renderSeite(nummer) {
    const seite = await pdfDokument.getPage(nummer);
    const basisViewport = seite.getViewport({ scale: 1 });

    const verfuegbar = Math.min(window.innerWidth - 40, 1400);
    const skalierung = verfuegbar / basisViewport.width;
    const viewport   = seite.getViewport({ scale: skalierung });

    canvas.width  = viewport.width;
    canvas.height = viewport.height;

    await seite.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

    srHinweisEl.textContent = '';

    if (nummer === 1) {
        seite1Original = seite;
        try {
            await zeichneTagesRahmen(seite);
        } catch (fehler) {
            console.warn('Tages-Rahmen konnte nicht gezeichnet werden (PDF wird trotzdem angezeigt):', fehler);
        }
    }

    aktuelleSeite = nummer;
    seitenInfo.textContent = 'Seite ' + nummer + ' von ' + pdfDokument.numPages;
    btnPrev.disabled = nummer <= 1;
    btnNext.disabled = nummer >= pdfDokument.numPages;
}

/* Zeichnet den farbigen Rahmen auf den sichtbaren Canvas.
   Die LINIEN-ERKENNUNG läuft dabei bewusst auf einem separaten,
   immer gleich hoch aufgelösten Hilfs-Canvas (1754px Breite) statt
   auf dem sichtbaren Canvas – auf kleinen Handy-Bildschirmen ist der
   sichtbare Canvas oft so schmal, dass die dünnen Tabellenlinien
   beim Verkleinern verschwimmen und nicht mehr zuverlässig gefunden
   werden. Das gefundene Ergebnis wird anschließend proportional auf
   die tatsächliche Anzeigegröße umgerechnet. */
async function zeichneTagesRahmen(seite) {
    const wochentagIndex = heutigerWochentagIndex();
    if (wochentagIndex > 4) return; // Wochenende

    const ANALYSE_BREITE = 1754;
    const basisViewport = seite.getViewport({ scale: 1 });
    const analyseSkala = ANALYSE_BREITE / basisViewport.width;
    const analyseViewport = seite.getViewport({ scale: analyseSkala });

    const analyseCanvas = document.createElement('canvas');
    analyseCanvas.width = analyseViewport.width;
    analyseCanvas.height = analyseViewport.height;
    await seite.render({ canvasContext: analyseCanvas.getContext('2d'), viewport: analyseViewport }).promise;

    const linienY = findeHorizontaleLinien(analyseCanvas);
    if (linienY.length < 7) return; // Layout nicht wie erwartet – lieber nichts zeichnen

    const startY = linienY[1 + wochentagIndex];
    const endeY  = linienY[2 + wochentagIndex];
    if (startY === undefined || endeY === undefined) return;

    // Umrechnung von der Analyse-Auflösung auf die tatsächliche
    // Anzeigegröße des sichtbaren Canvas
    const skalaFaktor = canvas.height / analyseCanvas.height;
    const startYSkaliert = startY * skalaFaktor;
    const endeYSkaliert  = endeY * skalaFaktor;

    const ctx = canvas.getContext('2d');
    const rand = 6;
    ctx.save();
    ctx.strokeStyle = '#2e7d32';
    ctx.lineWidth = 6;
    ctx.strokeRect(rand, startYSkaliert + rand / 2, canvas.width - rand * 2, (endeYSkaliert - startYSkaliert) - rand);
    ctx.restore();

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

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (pdfDokument) renderSeite(aktuelleSeite); }, 300);
});

(async function start() {
    let stufe = 'Datei suchen';
    try {
        const pfad = await findeDatei(kandidaten);

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
