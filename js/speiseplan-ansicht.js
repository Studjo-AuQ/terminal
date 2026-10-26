import * as pdfjsLib from '../pdfjs/pdf.min.mjs';
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

function wochenBasisDatum() {
    const jetzt = new Date();
    if (jetzt.getDay() === 1 && jetzt.getHours() < 7) {
        const zurueck = new Date(jetzt);
        zurueck.setDate(zurueck.getDate() - 3);
        return zurueck;
    }
    return jetzt;
}

function abUmschaltzeit(jetzt) {
    return jetzt.getHours() > 13 || (jetzt.getHours() === 13 && jetzt.getMinutes() >= 15);
}

function istBlackout(jetzt) {
    const tag = jetzt.getDay();
    if (tag === 6 || tag === 0) return true;
    if (tag === 5 && abUmschaltzeit(jetzt)) return true;
    if (tag === 1 && jetzt.getHours() < 7) return true;
    return false;
}

function effektiverTag() {
    const jetzt = new Date();
    if (istBlackout(jetzt)) return null;

    let ziel = new Date(jetzt);
    let istMorgen = false;
    if (abUmschaltzeit(jetzt)) {
        ziel.setDate(ziel.getDate() + 1);
        istMorgen = true;
    }

    const wochentagIndex = (ziel.getDay() + 6) % 7;
    const label = istMorgen ? 'Morgen' : 'Heute';
    return { ziel, wochentagIndex, label };
}

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
        } catch (e) {}
    }
    return null;
}

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
const bildLink     = document.getElementById('sp-bild-link');

let pdfDokument   = null;
let aktuelleSeite = 1;
let seite1Original = null;

function aktualisiereBildLink() {
    if (!bildLink || !pdfDokument || pdfDokument.numPages < 2) {
        if (bildLink) bildLink.hidden = true;
        return;
    }

    bildLink.hidden = false;
    const istBildseite = aktuelleSeite === 2;
    bildLink.classList.toggle('aktiv', istBildseite);
    bildLink.setAttribute('aria-pressed', istBildseite ? 'true' : 'false');
    bildLink.setAttribute(
        'aria-label',
        istBildseite
            ? 'Bebilderte Darstellung auf Seite 2 ist geöffnet'
            : 'Zur bebilderten Darstellung auf Seite 2 wechseln'
    );
}

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
    aktualisiereBildLink();
}

async function zeichneTagesRahmen(seite) {
    const tag = effektiverTag();
    if (tag === null) return;
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
    if (linienY.length < 7) return;

    const startY = linienY[1 + wochentagIndex];
    const endeY  = linienY[2 + wochentagIndex];
    if (startY === undefined || endeY === undefined) return;

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

bildLink.addEventListener('click', () => {
    if (!pdfDokument || pdfDokument.numPages < 2) return;
    if (aktuelleSeite !== 2) renderSeite(2);
});

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
            bildLink.hidden = true;
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
        aktualisiereBildLink();

        stufe = 'Seite anzeigen';
        await renderSeite(1);

    } catch (fehler) {
        console.error('Fehler beim Anzeigen des Speiseplans (Schritt: ' + stufe + '):', fehler);
        ladeEl.hidden = true;
        canvasWrap.hidden = true;
        bildLink.hidden = true;
        fehlerEl.querySelector('p').textContent =
            'Der Speiseplan konnte nicht angezeigt werden. ' +
            '(Technischer Fehler bei „' + stufe + '“: ' + (fehler && fehler.message ? fehler.message : fehler) + ')';
        fehlerEl.hidden = false;
    }
}

ladeEl.hidden = false;
let letzterZustand = basisDatumFuerOffset(offset).toDateString() + '|' + istBlackout(new Date());
start();

setInterval(() => {
    const neuerZustand = basisDatumFuerOffset(offset).toDateString() + '|' + istBlackout(new Date());
    if (neuerZustand !== letzterZustand) {
        letzterZustand = neuerZustand;
        start();
    }
}, 5 * 60 * 1000);
