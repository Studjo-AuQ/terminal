/* ══════════════════════════════════════════════════════
   speiseplan-heute.js – Version 4
   Studjo Terminal | Evangelisches Johanneswerk

   Version 4:
   - Seite 1: bewährte dunkle Raster-Erkennung + hochauflösende OCR bleibt erhalten.
   - Seite 2: neue robuste Raster-Erkennung für helle/farbige Tabellenlinien.
   - Zusätzliche proportionale Fallback-Geometrie, falls einzelne Linien
     durch ein leicht verändertes PDF-Design nicht sicher erkannt werden.
   - Dadurch bleiben die drei Essensbilder A1/A2/A3 auch bei Designänderungen
     wie rechts angeordneten Desserts zuverlässig sichtbar.
   ══════════════════════════════════════════════════════ */

import * as pdfjsLib from './pdfjs/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdfjs/pdf.worker.min.mjs';

const ORDNER = 'speiseplaene/';
const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
const SPALTEN_LABEL = ['Regionales & Klassiker', 'Gut & Wertvoll', 'Kaltmahlzeit'];

const MINDEST_KONFIDENZ = 55;

/* Seite 2 hat immer:
   4 Spalten = Tag | A1 | A2 | A3
   6 Zeilen  = Kopf | Montag | Dienstag | Mittwoch | Donnerstag | Freitag

   Diese Werte sind nur der Sicherheits-Fallback.
   Primär werden die echten Rasterlinien weiterhin aus dem PDF-Bild ermittelt. */
const BILDRASTER_X_REL = [0.0068, 0.1733, 0.4413, 0.7092, 0.9943];
const BILDRASTER_Y_REL = [0.0347, 0.1161, 0.2855, 0.4548, 0.6226, 0.7903, 0.9565];

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

    return { jahr: isoJahr, woche };
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
    return jetzt.getHours() > 13 ||
        (jetzt.getHours() === 13 && jetzt.getMinutes() >= 15);
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

    const ziel = new Date(jetzt);
    let istMorgen = false;

    if (abUmschaltzeit(jetzt)) {
        ziel.setDate(ziel.getDate() + 1);
        istMorgen = true;
    }

    const wochentagIndex = (ziel.getDay() + 6) % 7;

    return {
        ziel,
        wochentagIndex,
        label: istMorgen ? 'Morgen' : 'Heute'
    };
}

async function findeDatei(kandidaten) {
    for (const pfad of kandidaten) {
        try {
            const antwort = await fetch(pfad, { method: 'HEAD' });
            if (antwort.ok) return pfad;
        } catch (e) {
            /* nächsten Kandidaten versuchen */
        }
    }

    return null;
}

/* Bewährte Linien-Erkennung für Seite 1:
   sucht dunkle, weitgehend durchgehende Rasterlinien. */
function findeDunkleLinien(canvas, achse, schwelle = 0.5, dunkelWert = 130) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const { width, height } = canvas;
    const bild = ctx.getImageData(0, 0, width, height).data;

    const laenge = achse === 'horizontal' ? height : width;
    const breite = achse === 'horizontal' ? width : height;
    const kandidaten = [];

    for (let i = 0; i < laenge; i++) {
        let dunkleAnzahl = 0;

        for (let j = 0; j < breite; j += 2) {
            const x = achse === 'horizontal' ? j : i;
            const y = achse === 'horizontal' ? i : j;
            const idx = (y * width + x) * 4;

            const grau =
                (bild[idx] + bild[idx + 1] + bild[idx + 2]) / 3;

            if (grau < dunkelWert) dunkleAnzahl++;
        }

        if (dunkleAnzahl > (breite / 2) * schwelle) {
            kandidaten.push(i);
        }
    }

    return gruppiereLinien(kandidaten);
}

/* Neue Erkennung für Seite 2:
   Die Tabellenlinien sind seit den neueren PDF-Generierungen nicht mehr
   zwingend dunkel. Deshalb wird hier geprüft, ob ein Pixel deutlich von
   Weiß abweicht – unabhängig davon, ob die Linie blau, grau, grün oder
   dunkel ist.

   Bei der aktuellen KW42-PDF liefert diese Methode exakt:
   7 horizontale Linien und 5 vertikale Linien. */
function findeFarbRasterLinien(canvas, achse, deckung = 0.80, abstandVonWeiss = 50) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const { width, height } = canvas;
    const bild = ctx.getImageData(0, 0, width, height).data;

    const laenge = achse === 'horizontal' ? height : width;
    const breite = achse === 'horizontal' ? width : height;
    const kandidaten = [];

    for (let i = 0; i < laenge; i++) {
        let passendePixel = 0;

        for (let j = 0; j < breite; j += 2) {
            const x = achse === 'horizontal' ? j : i;
            const y = achse === 'horizontal' ? i : j;
            const idx = (y * width + x) * 4;

            const r = bild[idx];
            const g = bild[idx + 1];
            const b = bild[idx + 2];

            const weissAbstand = Math.max(
                255 - r,
                255 - g,
                255 - b
            );

            if (weissAbstand > abstandVonWeiss) {
                passendePixel++;
            }
        }

        if (passendePixel > (breite / 2) * deckung) {
            kandidaten.push(i);
        }
    }

    return gruppiereLinien(kandidaten);
}

function gruppiereLinien(kandidaten) {
    const gruppen = [];

    kandidaten.forEach(pos => {
        const letzte = gruppen[gruppen.length - 1];

        if (letzte && pos - letzte[letzte.length - 1] <= 10) {
            letzte.push(pos);
        } else {
            gruppen.push([pos]);
        }
    });

    return gruppen.map(
        gruppe => Math.round(
            gruppe.reduce((summe, wert) => summe + wert, 0) / gruppe.length
        )
    );
}

/* Aus eventuell zusätzlich erkannten Linien werden genau die erwarteten
   Tabellenlinien gewählt. Liegt an einer Soll-Position keine plausible
   erkannte Linie, wird nur für diese einzelne Position auf die bewährte
   proportionale Geometrie zurückgefallen. */
function waehleRasterLinien(gefunden, relativeSollwerte, gesamtLaenge, toleranz = 0.045) {
    const ergebnis = [];
    const benutzt = new Set();

    relativeSollwerte.forEach(rel => {
        const soll = rel * gesamtLaenge;

        let besterIndex = -1;
        let besteAbweichung = Infinity;

        gefunden.forEach((wert, index) => {
            if (benutzt.has(index)) return;

            const abweichung = Math.abs(wert - soll);

            if (abweichung < besteAbweichung) {
                besteAbweichung = abweichung;
                besterIndex = index;
            }
        });

        if (
            besterIndex >= 0 &&
            besteAbweichung <= gesamtLaenge * toleranz
        ) {
            benutzt.add(besterIndex);
            ergebnis.push(gefunden[besterIndex]);
        } else {
            ergebnis.push(Math.round(soll));
        }
    });

    return ergebnis;
}

function ermittleBildRaster(seite2) {
    const erkanntY = findeFarbRasterLinien(
        seite2,
        'horizontal',
        0.80,
        50
    );

    const erkanntX = findeFarbRasterLinien(
        seite2,
        'vertikal',
        0.80,
        50
    );

    const linienY = waehleRasterLinien(
        erkanntY,
        BILDRASTER_Y_REL,
        seite2.height
    );

    const linienX = waehleRasterLinien(
        erkanntX,
        BILDRASTER_X_REL,
        seite2.width
    );

    console.info(
        '[Studjo Speiseplan] Bilderraster Seite 2:',
        'erkannt Y=', erkanntY,
        'erkannt X=', erkanntX,
        'verwendet Y=', linienY,
        'verwendet X=', linienX
    );

    return { linienY, linienX };
}

function bereinigeZeilen(zeilenMitKonfidenz) {
    const guteZeilen = zeilenMitKonfidenz
        .filter(
            z =>
                z.confidence === undefined ||
                z.confidence >= MINDEST_KONFIDENZ
        )
        .map(z => z.text);

    let text = guteZeilen.join(' ');

    text = text.replace(/\[[^\]]*\]/g, '\n');
    text = text.replace(/kcal:?\s*\d+\s*\]?/gi, '\n');
    text = text.replace(/[\[\]]/g, ' ');

    return text
        .split(/\n+/)
        .map(
            zeile =>
                zeile
                    .replace(/[|_~]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim()
        )
        .filter(
            zeile =>
                zeile.length > 1 &&
                /[a-zäöüß]/i.test(zeile)
        )
        .map(zeile => kuerzeAmWortende(zeile, 60))
        .join('\n');
}

function kuerzeAmWortende(zeile, maxLaenge) {
    if (zeile.length <= maxLaenge) return zeile;

    const geschnitten = zeile.slice(0, maxLaenge);
    const letzteLeerstelle = geschnitten.lastIndexOf(' ');

    return (
        letzteLeerstelle > 10
            ? geschnitten.slice(0, letzteLeerstelle)
            : geschnitten
    ).trim() + '…';
}

async function rendereSeite(pdfDokument, nummer, zielBreite) {
    const seite = await pdfDokument.getPage(nummer);
    const basis = seite.getViewport({ scale: 1 });
    const skala = zielBreite / basis.width;
    const viewport = seite.getViewport({ scale: skala });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);

    await seite.render({
        canvasContext: canvas.getContext('2d'),
        viewport
    }).promise;

    return canvas;
}

function schneideZu(quelle, x, y, breite, hoehe, innenRand = 0) {
    x = Math.round(x + innenRand);
    y = Math.round(y + innenRand);
    breite = Math.round(breite - innenRand * 2);
    hoehe = Math.round(hoehe - innenRand * 2);

    if (breite <= 0 || hoehe <= 0) {
        throw new Error('Ungültiger Bildausschnitt');
    }

    const ziel = document.createElement('canvas');
    ziel.width = breite;
    ziel.height = hoehe;

    ziel.getContext('2d').drawImage(
        quelle,
        x,
        y,
        breite,
        hoehe,
        0,
        0,
        breite,
        hoehe
    );

    return ziel;
}

function schwarzWeiss(quelle, schwellenwert = 165) {
    const ziel = document.createElement('canvas');
    ziel.width = quelle.width;
    ziel.height = quelle.height;

    const ctx = ziel.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(quelle, 0, 0);

    const bild = ctx.getImageData(0, 0, ziel.width, ziel.height);
    const daten = bild.data;

    for (let i = 0; i < daten.length; i += 4) {
        const grau =
            0.299 * daten[i] +
            0.587 * daten[i + 1] +
            0.114 * daten[i + 2];

        const wert = grau > schwellenwert ? 255 : 0;

        daten[i] = wert;
        daten[i + 1] = wert;
        daten[i + 2] = wert;
    }

    ctx.putImageData(bild, 0, 0);

    return ziel;
}

async function start() {
    const ladeEl        = document.getElementById('sp-heute-lade');
    const fehlerEl      = document.getElementById('sp-heute-fehler');
    const kartenWrap    = document.getElementById('sp-heute-karten');
    const wochenendEl   = document.getElementById('sp-heute-wochenende');
    const tagLabelEl    = document.getElementById('sp-heute-tag-label');
    const heuteMorgenEl = document.getElementById('sp-heute-heute-morgen');

    ladeEl.hidden = false;
    fehlerEl.hidden = true;
    kartenWrap.hidden = true;
    wochenendEl.hidden = true;

    kartenWrap.querySelectorAll('.sp-heute-bild').forEach(img => {
        img.hidden = true;
        img.removeAttribute('src');
    });

    const tag = effektiverTag();

    if (tag === null) {
        ladeEl.hidden = true;
        wochenendEl.hidden = false;
        return;
    }

    const { wochentagIndex, label } = tag;

    heuteMorgenEl.textContent =
        label === 'Heute' || label === 'Morgen'
            ? label
            : 'Am';

    tagLabelEl.textContent =
        WOCHENTAGE[wochentagIndex];

    const kandidaten =
        kandidatenFuerDatum(
            wochenBasisDatum()
        );

    let stufe = 'Datei suchen';
    let worker = null;

    try {
        const pfad =
            await findeDatei(
                kandidaten
            );

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

        const pdfDokument =
            await pdfjsLib.getDocument(
                pfad
            ).promise;

        stufe = 'Seite 1 rendern (Analyse)';

        const seite1Analyse =
            await rendereSeite(
                pdfDokument,
                1,
                1754
            );

        stufe = 'Tabellenraster auf Seite 1 erkennen';

        const linienYAnalyse =
            findeDunkleLinien(
                seite1Analyse,
                'horizontal',
                0.5,
                130
            );

        const linienXAnalyse =
            findeDunkleLinien(
                seite1Analyse,
                'vertikal',
                0.5,
                130
            );

        if (
            linienYAnalyse.length < 7 ||
            linienXAnalyse.length < 4
        ) {
            throw new Error(
                'Tabellenraster auf Seite 1 nicht wie erwartet erkannt ' +
                '(Linien Y: ' + linienYAnalyse.length +
                ', X: ' + linienXAnalyse.length + ')'
            );
        }

        stufe = 'Seite 1 rendern (hohe Auflösung für OCR)';

        const seite1 =
            await rendereSeite(
                pdfDokument,
                1,
                3200
            );

        const hochSkala =
            seite1.width /
            seite1Analyse.width;

        const linienY =
            linienYAnalyse.map(
                y => y * hochSkala
            );

        const linienX =
            linienXAnalyse.map(
                x => x * hochSkala
            );

        const zeileStart =
            linienY[
                1 + wochentagIndex
            ];

        const zeileEnde =
            linienY[
                2 + wochentagIndex
            ];

        let seite2 = null;
        let bildLinienY = null;
        let bildLinienX = null;

        if (
            pdfDokument.numPages > 1
        ) {
            stufe = 'Seite 2 (Bilder) rendern';

            seite2 =
                await rendereSeite(
                    pdfDokument,
                    2,
                    1754
                );

            stufe = 'Bilderraster auf Seite 2 erkennen';

            const raster =
                ermittleBildRaster(
                    seite2
                );

            bildLinienY =
                raster.linienY;

            bildLinienX =
                raster.linienX;
        }

        stufe = 'Texterkennung (OCR)';

        worker =
            await Tesseract.createWorker(
                'deu'
            );

        await worker.setParameters({
            tessedit_pageseg_mode: '6'
        });

        const spaltenGrenzen = [
            linienX[0],
            linienX[1],
            linienX[2],
            linienX[3]
        ];

        for (
            let spalte = 0;
            spalte < 3;
            spalte++
        ) {
            const x0 =
                spaltenGrenzen[
                    spalte
                ];

            const x1 =
                spaltenGrenzen[
                    spalte + 1
                ];

            const zelleRoh =
                schneideZu(
                    seite1,
                    x0,
                    zeileStart,
                    x1 - x0,
                    zeileEnde - zeileStart
                );

            const zelleSw =
                schwarzWeiss(
                    zelleRoh
                );

            const { data } =
                await worker.recognize(
                    zelleSw
                );

            const zeilenMitKonfidenz =
                data.lines &&
                data.lines.length > 0
                    ? data.lines.map(
                        l => ({
                            text: l.text,
                            confidence:
                                l.confidence
                        })
                    )
                    : data.text
                        .split('\n')
                        .map(
                            text => ({
                                text,
                                confidence:
                                    undefined
                            })
                        );

            const text =
                bereinigeZeilen(
                    zeilenMitKonfidenz
                );

            const karte =
                kartenWrap.children[
                    spalte
                ];

            karte
                .querySelector(
                    '.sp-heute-spalten-name'
                )
                .textContent =
                    SPALTEN_LABEL[
                        spalte
                    ] || '';

            karte
                .querySelector(
                    '.sp-heute-text'
                )
                .textContent =
                    text ||
                    '(nicht erkannt)';

            if (
                seite2 &&
                bildLinienY &&
                bildLinienX
            ) {
                try {
                    const by0 =
                        bildLinienY[
                            1 + wochentagIndex
                        ];

                    const by1 =
                        bildLinienY[
                            2 + wochentagIndex
                        ];

                    const bx0 =
                        bildLinienX[
                            1 + spalte
                        ];

                    const bx1 =
                        bildLinienX[
                            2 + spalte
                        ];

                    if (
                        [by0, by1, bx0, bx1]
                            .every(
                                Number.isFinite
                            )
                    ) {
                        /* 3 Pixel Innenrand entfernen die Tabellenlinie,
                           ohne den Essensbereich oder den rechts platzierten
                           Nachtisch abzuschneiden. */
                        const bild =
                            schneideZu(
                                seite2,
                                bx0,
                                by0,
                                bx1 - bx0,
                                by1 - by0,
                                3
                            );

                        const img =
                            karte.querySelector(
                                '.sp-heute-bild'
                            );

                        img.src =
                            bild.toDataURL(
                                'image/jpeg',
                                0.88
                            );

                        img.alt =
                            'Essensbild ' +
                            (SPALTEN_LABEL[spalte] || '') +
                            ' für ' +
                            WOCHENTAGE[wochentagIndex];

                        img.hidden = false;
                    }
                } catch (bildFehler) {
                    console.warn(
                        'Bild für Spalte ' +
                        spalte +
                        ' konnte nicht zugeschnitten werden:',
                        bildFehler
                    );
                }
            }
        }

        if (worker) {
            await worker.terminate();
            worker = null;
        }

        ladeEl.hidden = true;
        kartenWrap.hidden = false;

    } catch (fehler) {
        if (worker) {
            try {
                await worker.terminate();
            } catch (e) {}
        }

        console.error(
            'Tagesangebot konnte nicht ermittelt werden ' +
            '(Schritt: ' + stufe + '):',
            fehler
        );

        ladeEl.hidden = true;

        fehlerEl.querySelector('p').textContent =
            'Das Tagesangebot konnte nicht automatisch erkannt werden. ' +
            '(Technischer Fehler bei „' +
            stufe +
            '“: ' +
            (
                fehler &&
                fehler.message
                    ? fehler.message
                    : fehler
            ) +
            ') Schau bitte direkt im Speiseplan nach.';

        fehlerEl.hidden = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    let letzterZustand =
        wochenBasisDatum().toDateString() +
        '|' +
        istBlackout(new Date());

    start();

    setInterval(() => {
        const neuerZustand =
            wochenBasisDatum().toDateString() +
            '|' +
            istBlackout(new Date());

        if (
            neuerZustand !==
            letzterZustand
        ) {
            letzterZustand =
                neuerZustand;

            start();
        }
    }, 5 * 60 * 1000);
});
