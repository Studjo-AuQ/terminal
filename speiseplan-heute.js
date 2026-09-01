/* ══════════════════════════════════════════════════════
   speiseplan-heute.js
   Studjo Terminal | Evangelisches Johanneswerk

   Liest automatisch das heutige Tagesangebot aus dem
   "aktuelle Woche"-PDF (Seite 1 = Tabelle, Seite 2 =
   passende Essensbilder) und zeigt es direkt auf
   speiseplan.html an.

   WICHTIG: Das PDF enthält keinen echten Text (nur ein
   eingebettetes Bild) – die drei Gerichte werden daher per
   Texterkennung (OCR, Tesseract.js) erkannt. Das läuft
   vollständig im Browser (keine Cloud, DSGVO-konform),
   kann aber ein paar Sekunden dauern und ist nicht zu
   100 % fehlerfrei – daher der Hinweis in der Anzeige und
   ein Link zum Original-PDF als Kontrolle.
   ══════════════════════════════════════════════════════ */

import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

const ORDNER = 'speiseplaene/';
const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
// Feste Spaltenbezeichnungen (passend zum aktuellen Catering-Layout).
// Ändert das Catering-Team die Spaltentitel, hier anpassen.
const SPALTEN_LABEL = ['Regionales und Klassiker', 'Gut & Wertvoll', 'Kaltmahlzeit'];

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

function dateinameAktuelleWoche() {
    const { jahr, woche } = getISOWocheJahr(new Date());
    return ORDNER + 'speiseplan_' + jahr + '-KW' + String(woche).padStart(2, '0') + '.pdf';
}

/* Entfernt Klammer-Zusätze wie "[ML, GG / 0, 3 / kcal: 167]" und
   räumt Zeilenumbrüche/Leerzeichen auf – übrig bleibt nur der
   eigentliche Speisename. */
function bereinigeText(roh) {
    return roh
        .replace(/\[[^\]]*\]?/g, '')   // Klammerinhalte entfernen (auch unvollständig erkannte)
        .replace(/[|_~]/g, '')
        .split(/\n+/)
        .map(z => z.trim())
        .filter(z => z.length > 1)
        .join('\n');
}

/* Rendert eine PDF-Seite in gewünschter Auflösung auf einen neuen Canvas */
async function rendereSeite(pdfDokument, nummer, zielBreite) {
    const seite = await pdfDokument.getPage(nummer);
    const basis = seite.getViewport({ scale: 1 });
    const skala = zielBreite / basis.width;
    const viewport = seite.getViewport({ scale: skala });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await seite.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return canvas;
}

/* Schneidet einen Bereich aus einem Canvas in einen neuen Canvas */
function schneideZu(quelle, x, y, breite, hoehe) {
    const ziel = document.createElement('canvas');
    ziel.width = breite;
    ziel.height = hoehe;
    ziel.getContext('2d').drawImage(quelle, x, y, breite, hoehe, 0, 0, breite, hoehe);
    return ziel;
}

async function start() {
    const bereich    = document.getElementById('sp-heute-bereich');
    const ladeEl     = document.getElementById('sp-heute-lade');
    const fehlerEl   = document.getElementById('sp-heute-fehler');
    const kartenWrap = document.getElementById('sp-heute-karten');
    const wochenendEl = document.getElementById('sp-heute-wochenende');
    const tagLabelEl = document.getElementById('sp-heute-tag-label');

    const wochentagIndex = window.SpeiseplanErkennung.heutigerWochentagIndex(); // 0=Mo…6=So

    if (wochentagIndex > 4) {
        ladeEl.hidden = true;
        wochenendEl.hidden = false;
        return;
    }

    tagLabelEl.textContent = WOCHENTAGE[wochentagIndex];

    const pfad = dateinameAktuelleWoche();

    try {
        const kopfAntwort = await fetch(pfad, { method: 'HEAD' });
        if (!kopfAntwort.ok) throw new Error('PDF nicht gefunden');

        const pdfDokument = await pdfjsLib.getDocument(pfad).promise;

        // Seite 1 (Tabelle) in guter Auflösung rendern, um die OCR-Qualität
        // der einzelnen Zellen zu verbessern
        const seite1 = await rendereSeite(pdfDokument, 1, 1754);

        const linienY = window.SpeiseplanErkennung.findeLinien(seite1, 'horizontal', 0.5, 130);
        const linienX = window.SpeiseplanErkennung.findeLinien(seite1, 'vertikal', 0.5, 130);

        if (linienY.length < 7 || linienX.length < 4) {
            throw new Error('Tabellenraster auf Seite 1 nicht wie erwartet erkannt');
        }

        const zeileStart = linienY[1 + wochentagIndex];
        const zeileEnde  = linienY[2 + wochentagIndex];

        // Seite 2 (Essensbilder) nur bei Bedarf rendern
        let seite2 = null;
        let linienY2 = null, linienX2 = null;
        if (pdfDokument.numPages > 1) {
            seite2 = await rendereSeite(pdfDokument, 2, 1754);
            linienY2 = window.SpeiseplanErkennung.findeLinien(seite2, 'horizontal', 0.5, 100);
            linienX2 = window.SpeiseplanErkennung.findeLinien(seite2, 'vertikal', 0.5, 100);
        }

        // Tesseract.js: EIN Worker für alle drei Spalten wiederverwenden
        const worker = await Tesseract.createWorker('deu');

        const spaltenGrenzen = [linienX[0], linienX[1], linienX[2], linienX[3]];

        for (let spalte = 0; spalte < 3; spalte++) {
            const x0 = spaltenGrenzen[spalte];
            const x1 = spaltenGrenzen[spalte + 1];

            const zelle = schneideZu(seite1, x0, zeileStart, x1 - x0, zeileEnde - zeileStart);
            const { data } = await worker.recognize(zelle);
            const text = bereinigeText(data.text);

            const karte = kartenWrap.children[spalte];
            karte.querySelector('.sp-heute-spalten-titel').textContent = SPALTEN_LABEL[spalte] || '';
            karte.querySelector('.sp-heute-text').textContent = text || '(nicht erkannt)';

            // Passendes Bild aus Seite 2 zuschneiden (gleiche Zeile,
            // gleiche Spaltenposition A1/A2/A3)
            if (seite2 && linienY2 && linienY2.length >= 7 && linienX2 && linienX2.length >= 5) {
                const by0 = linienY2[1 + wochentagIndex];
                const by1 = linienY2[2 + wochentagIndex];
                const bx0 = linienX2[1 + spalte];
                const bx1 = linienX2[2 + spalte];
                if ([by0, by1, bx0, bx1].every(v => v !== undefined)) {
                    const bild = schneideZu(seite2, bx0, by0, bx1 - bx0, by1 - by0);
                    const img = karte.querySelector('.sp-heute-bild');
                    img.src = bild.toDataURL('image/jpeg', 0.85);
                    img.hidden = false;
                }
            }
        }

        await worker.terminate();

        ladeEl.hidden = true;
        kartenWrap.hidden = false;

    } catch (fehler) {
        console.error('Tagesangebot konnte nicht ermittelt werden:', fehler);
        ladeEl.hidden = true;
        fehlerEl.hidden = false;
    }
}

document.addEventListener('DOMContentLoaded', start);
