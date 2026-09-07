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

function kandidatenFuerDatum(datum) {
    const { jahr, woche } = getISOWocheJahr(datum);
    const woche2 = String(woche).padStart(2, '0');
    return [
        ORDNER + 'speiseplan_' + jahr + '-KW' + woche2 + '.pdf',
        ORDNER + 'Speiseplan_' + jahr + '-KW' + woche2 + '.pdf',
        ORDNER + 'speiseplan_' + jahr + '-KW' + woche + '.pdf',
        ORDNER + 'Speiseplan_' + jahr + '-KW' + woche + '.pdf',
    ];
}

/* ── Wochen-Auswahl (welche der 3 PDF-Dateien) ──
   Wechselt NUR montags um 7:00 Uhr, unabhängig von der Tageszeit
   sonst. Das Wochenende (Sa/So) gehört durch die normale ISO-Woche-
   Berechnung ohnehin schon zur gerade laufenden (Freitag-)Woche –
   nur der Montagmorgen braucht eine kleine Verzögerung, damit die
   3 Kacheln nicht schon um Mitternacht umspringen. */
function wochenBasisDatum() {
    const jetzt = new Date();
    if (jetzt.getDay() === 1 && jetzt.getHours() < 7) {
        const zurueck = new Date(jetzt);
        zurueck.setDate(zurueck.getDate() - 3); // auf Freitag der Vorwoche zurück
        return zurueck;
    }
    return jetzt;
}

/* ── Blackout-Fenster für die Tages-Vorschau ──
   Freitag ab 15:00 Uhr bis Montag 7:00 Uhr: kein Werkstattbetrieb,
   daher auch keine "Heute/Morgen"-Umrandung. */
function istBlackout(jetzt) {
    const tag = jetzt.getDay(); // 0=So … 6=Sa
    if (tag === 6 || tag === 0) return true;
    if (tag === 5 && jetzt.getHours() >= 15) return true;
    if (tag === 1 && jetzt.getHours() < 7) return true;
    return false;
}

/* Ab 15:00 Uhr (Mo-Do) wird bereits der Folgetag umrandet ("Morgen"),
   um Mitternacht springt es automatisch auf "Heute" zurück. Während
   des Blackout-Fensters (siehe oben) wird nichts umrandet. Gilt nur
   für die Kachel "Aktuelle Woche" (woche=0). */
function effektiverTag() {
    const jetzt = new Date();
    if (istBlackout(jetzt)) return null;

    let ziel = new Date(jetzt);
    let istMorgen = false;
    if (jetzt.getHours() >= 15) {
        ziel.setDate(ziel.getDate() + 1);
        istMorgen = true;
    }

    const wochentagIndex = (ziel.getDay() + 6) % 7;
    const label = istMorgen ? 'Morgen' : 'Heute';
    return { ziel, wochentagIndex, label };
}

/* Basisdatum für die Dateisuche: IMMER das stabile Wochen-Basisdatum
   (siehe wochenBasisDatum) plus den Wochen-Offset der jeweiligen
   Kachel – unabhängig von der Tageszeit. So können "Aktuelle Woche"
   und "Nächste Woche" nie auf dieselbe Datei zeigen. */
function basisDatumFuerOffset(offsetWochen) {
    const datum = new Date(wochenBasisDatum());
    datum.setDate(datum.getDate() + offsetWochen * 7);
    return datum;
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

const params = new URLSearchParams(window.location.search);
let offset = parseInt(params.get('woche'), 10);
if (isNaN(offset) || offset < 0 || offset > 2) offset = 0;

document.getElementById('sp-titel').textContent =
    '📄 Speiseplan – ' + (TITEL[offset] || 'Aktuelle Woche');

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

    if (nummer === 1 && offset === 0) {
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
    // Diese Funktion wird nur noch aufgerufen, wenn offset === 0 ist
    // (siehe renderSeite).
    const tag = effektiverTag();
    if (tag === null) return; // Blackout-Fenster (Wochenende/Freitagnachmittag/Montagfrüh) – nichts umranden
    const { wochentagIndex } = tag;

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

    const bezeichnung = tag.label;
    srHinweisEl.textContent =
        bezeichnung + ': ' + WOCHENTAGE[wochentagIndex] + '. ' +
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

async function start() {
    let stufe = 'Datei suchen';
    try {
        const pfad = await findeDatei(kandidatenFuerDatum(basisDatumFuerOffset(offset)));

        if (!pfad) {
            ladeEl.hidden = true;
            canvasWrap.hidden = true;
            navEl.hidden = true;
            fehlerEl.querySelector('p').innerHTML =
                'Dieser Speiseplan ist noch nicht veröffentlicht.<br>' +
                '<small>Erwartete Datei: ' + kandidatenFuerDatum(basisDatumFuerOffset(offset))[0] + '</small>';
            fehlerEl.hidden = false;
            return;
        }

        stufe = 'PDF laden';
        pdfDokument = await pdfjsLib.getDocument(pfad).promise;

        ladeEl.hidden = true;
        fehlerEl.hidden = true;
        canvasWrap.hidden = false;
        navEl.hidden = (pdfDokument.numPages <= 1);

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
}

ladeEl.hidden = false;
let letzterZustand = basisDatumFuerOffset(offset).toDateString() + '|' + istBlackout(new Date());
start();

// Terminal-Seiten bleiben oft dauerhaft geöffnet. Alle 5 Minuten
// prüfen, ob sich das Basisdatum ODER der Blackout-Status geändert
// hat (z. B. Montag 7 Uhr für die Datei, Freitag 15 Uhr fürs
// Blackout-Fenster) – nur dann wird neu geladen.
setInterval(() => {
    const neuerZustand = basisDatumFuerOffset(offset).toDateString() + '|' + istBlackout(new Date());
    if (neuerZustand !== letzterZustand) {
        letzterZustand = neuerZustand;
        start();
    }
}, 5 * 60 * 1000);
