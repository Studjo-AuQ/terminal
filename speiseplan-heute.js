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

function kandidatenAktuelleWoche() {
    const { jahr, woche } = getISOWocheJahr(new Date());
    const woche2 = String(woche).padStart(2, '0');
    return [
        ORDNER + 'speiseplan_' + jahr + '-KW' + woche2 + '.pdf',
        ORDNER + 'Speiseplan_' + jahr + '-KW' + woche2 + '.pdf',
        ORDNER + 'speiseplan_' + jahr + '-KW' + woche + '.pdf',
        ORDNER + 'Speiseplan_' + jahr + '-KW' + woche + '.pdf',
    ];
}

/* Schneidet jede Zeile an der ersten öffnenden eckigen Klammer ab –
   übrig bleibt nur der Speisename vor den Zusatz-Angaben (Allergene,
   kcal usw.). Robuster als eine Klammer-Entfernung per Regex, da bei
   OCR-Fehlern die schließende Klammer "]" öfter falsch erkannt wird
   als die öffnende "[". */
function bereinigeText(roh) {
    return roh
        .split(/\n+/)
        .map(zeile => {
            const klammerIndex = zeile.indexOf('[');
            const gekuerzt = klammerIndex >= 0 ? zeile.slice(0, klammerIndex) : zeile;
            return gekuerzt.replace(/[|_~]/g, '').trim();
        })
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

    const kandidaten = kandidatenAktuelleWoche();
    let stufe = 'Datei suchen';

    try {
        const pfad = await window.SpeiseplanErkennung.findeDatei(kandidaten);

        if (!pfad) {
            ladeEl.hidden = true;
            fehlerEl.querySelector('p').innerHTML =
                'Das Tagesangebot konnte gerade nicht automatisch erkannt werden.<br>' +
                '<small>Erwartete Datei: ' + kandidaten[0] + '</small><br>' +
                'Schau bitte direkt im Speiseplan nach.';
            fehlerEl.hidden = false;
            return;
        }

        stufe = 'PDF laden';
        const pdfDokument = await pdfjsLib.getDocument(pfad).promise;

        stufe = 'Seite 1 rendern';
        const seite1 = await rendereSeite(pdfDokument, 1, 1754);

        stufe = 'Tabellenraster erkennen';
        const linienY = window.SpeiseplanErkennung.findeLinien(seite1, 'horizontal', 0.5, 130);
        const linienX = window.SpeiseplanErkennung.findeLinien(seite1, 'vertikal', 0.5, 130);

        if (linienY.length < 7 || linienX.length < 4) {
            throw new Error('Tabellenraster auf Seite 1 nicht wie erwartet erkannt (Linien Y: ' +
                linienY.length + ', X: ' + linienX.length + ')');
        }

        const zeileStart = linienY[1 + wochentagIndex];
        const zeileEnde  = linienY[2 + wochentagIndex];

        // Seite 2 (Essensbilder) nur bei Bedarf rendern
        let seite2 = null;
        let linienY2 = null, linienX2 = null;
        if (pdfDokument.numPages > 1) {
            stufe = 'Seite 2 (Bilder) rendern';
            seite2 = await rendereSeite(pdfDokument, 2, 1754);
            linienY2 = window.SpeiseplanErkennung.findeLinien(seite2, 'horizontal', 0.5, 100);
            linienX2 = window.SpeiseplanErkennung.findeLinien(seite2, 'vertikal', 0.5, 100);
        }

        stufe = 'Texterkennung (OCR)';
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
            // gleiche Spaltenposition A1/A2/A3). Schlägt das fehl,
            // bleibt einfach nur der Text stehen.
            try {
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
            } catch (bildFehler) {
                console.warn('Bild für Spalte ' + spalte + ' konnte nicht zugeschnitten werden:', bildFehler);
            }
        }

        await worker.terminate();

        ladeEl.hidden = true;
        kartenWrap.hidden = false;

    } catch (fehler) {
        console.error('Tagesangebot konnte nicht ermittelt werden (Schritt: ' + stufe + '):', fehler);
        ladeEl.hidden = true;
        fehlerEl.querySelector('p').textContent =
            'Das Tagesangebot konnte nicht automatisch erkannt werden. ' +
            '(Technischer Fehler bei „' + stufe + '“: ' + (fehler && fehler.message ? fehler.message : fehler) + ') ' +
            'Schau bitte direkt im Speiseplan nach.';
        fehlerEl.hidden = false;
    }
}

document.addEventListener('DOMContentLoaded', start);
