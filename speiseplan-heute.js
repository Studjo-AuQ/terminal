/* ══════════════════════════════════════════════════════
   speiseplan-heute.js  (Version 2 – in sich geschlossen,
   verbesserte OCR-Qualität)
   Studjo Terminal | Evangelisches Johanneswerk

   Änderungen gegenüber Version 1:
   - Keine Abhängigkeit mehr zu speiseplan-erkennung.js
     (verhindert Datei-Sync-Fehler zwischen mehreren Dateien)
   - Die Tabellen-Zelle wird für die Texterkennung in deutlich
     höherer Auflösung gerendert (statt 1754px Seitenbreite
     jetzt 3200px) – kleine Schrift wird dadurch spürbar
     schärfer erkannt.
   - Vor der Texterkennung wird die Zelle in Graustufen
     umgewandelt und stark kontrastiert (Schwarz/Weiß) –
     das ist der wichtigste Hebel für bessere OCR-Ergebnisse
     bei gedrucktem Text.
   - Tesseract bekommt den Hinweis, dass es sich um einen
     einzelnen, gleichmäßigen Textblock handelt (kein
     Zeitungslayout mit mehreren Spalten) – das verbessert
     die Zeilenerkennung innerhalb der kleinen Zelle.
   ══════════════════════════════════════════════════════ */

import * as pdfjsLib from './pdfjs/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdfjs/pdf.worker.min.mjs';

const ORDNER = 'speiseplaene/';
const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
const SPALTEN_LABEL = ['Regionales & Klassiker', 'Gut & Wertvoll', 'Kaltmahlzeit'];

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

/* Ab 15:00 Uhr wird bereits der Folgetag angezeigt (Beschriftung
   "Morgen"), damit Beschäftigte sich schon auf morgen einstellen
   können. Um Mitternacht springt die Beschriftung automatisch auf
   "Heute" zurück, da dann kein Zeitversatz mehr vorliegt. Fällt der
   Zieltag auf ein Wochenende, wird auf den nächsten Montag
   weitergesprungen (Beschriftung zeigt dann den Wochentagsnamen
   statt "Morgen", da es sich um mehr als einen Tag Vorlauf handelt). */
function effektivesZiel() {
    const jetzt = new Date();
    let ziel = new Date(jetzt);
    let istMorgen = false;

    if (jetzt.getHours() >= 15) {
        ziel.setDate(ziel.getDate() + 1);
        istMorgen = true;
    }

    let wochentagIndex = (ziel.getDay() + 6) % 7;
    let uebersprungen = false;
    while (wochentagIndex > 4) {
        ziel.setDate(ziel.getDate() + 1);
        wochentagIndex = (ziel.getDay() + 6) % 7;
        uebersprungen = true;
    }

    let label;
    if (uebersprungen) label = WOCHENTAGE[wochentagIndex];
    else if (istMorgen) label = 'Morgen';
    else label = 'Heute';

    return { ziel, wochentagIndex, label };
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

function findeLinien(canvas, achse, schwelle = 0.5, dunkelWert = 130) {
    const ctx = canvas.getContext('2d');
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
            const grau = (bild[idx] + bild[idx + 1] + bild[idx + 2]) / 3;
            if (grau < dunkelWert) dunkleAnzahl++;
        }
        if (dunkleAnzahl > (breite / 2) * schwelle) kandidaten.push(i);
    }

    const gruppen = [];
    kandidaten.forEach(pos => {
        const letzte = gruppen[gruppen.length - 1];
        if (letzte && pos - letzte[letzte.length - 1] <= 10) letzte.push(pos);
        else gruppen.push([pos]);
    });
    return gruppen.map(g => Math.round(g.reduce((a, b) => a + b, 0) / g.length));
}

/* Schneidet jede Zeile an der ersten öffnenden eckigen Klammer ab. */
function bereinigeText(roh) {
    return roh
        .split(/\n+/)
        .map(zeile => {
            const klammerIndex = zeile.indexOf('[');
            const gekuerzt = klammerIndex >= 0 ? zeile.slice(0, klammerIndex) : zeile;
            let sauber = gekuerzt.replace(/[|_~]/g, '').trim();
            // Zusätzliche Sicherheit: maximal 3 Wörter je Zeile. Fängt
            // Fälle ab, in denen die Klammer von der Texterkennung gar
            // nicht erst erkannt wurde und sonst lange Zahlenkolonnen
            // stehen blieben.
            sauber = sauber.split(/\s+/).slice(0, 3).join(' ');
            return sauber;
        })
        .filter(z => z.length > 1)
        .join('\n');
}

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

function schneideZu(quelle, x, y, breite, hoehe) {
    x = Math.round(x); y = Math.round(y);
    breite = Math.round(breite); hoehe = Math.round(hoehe);
    const ziel = document.createElement('canvas');
    ziel.width = breite;
    ziel.height = hoehe;
    ziel.getContext('2d').drawImage(quelle, x, y, breite, hoehe, 0, 0, breite, hoehe);
    return ziel;
}

/* Graustufen + harter Schwarz/Weiß-Kontrast – der wichtigste
   einzelne Hebel für bessere OCR-Ergebnisse bei sauber
   gedrucktem Text auf hellem Hintergrund. */
function schwarzWeiss(quelle, schwellenwert = 165) {
    const ziel = document.createElement('canvas');
    ziel.width = quelle.width;
    ziel.height = quelle.height;
    const ctx = ziel.getContext('2d');
    ctx.drawImage(quelle, 0, 0);

    const bild = ctx.getImageData(0, 0, ziel.width, ziel.height);
    const daten = bild.data;
    for (let i = 0; i < daten.length; i += 4) {
        const grau = 0.299 * daten[i] + 0.587 * daten[i + 1] + 0.114 * daten[i + 2];
        const wert = grau > schwellenwert ? 255 : 0;
        daten[i] = daten[i + 1] = daten[i + 2] = wert;
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

    // Zustände zurücksetzen (wichtig für die automatische
    // Neuprüfung bei langer Laufzeit auf dem Terminal)
    ladeEl.hidden = false;
    fehlerEl.hidden = true;
    kartenWrap.hidden = true;
    wochenendEl.hidden = true;

    const { ziel, wochentagIndex, label } = effektivesZiel();

    if (wochentagIndex > 4) {
        // Sollte durch effektivesZiel() nicht mehr vorkommen
        // (Wochenende wird automatisch auf Montag verschoben),
        // bleibt als Sicherheitsnetz bestehen.
        ladeEl.hidden = true;
        wochenendEl.hidden = false;
        return;
    }

    heuteMorgenEl.textContent = (label === 'Heute' || label === 'Morgen') ? label : 'Am';
    tagLabelEl.textContent = WOCHENTAGE[wochentagIndex];

    const kandidaten = kandidatenFuerDatum(ziel);
    let stufe = 'Datei suchen';

    try {
        const pfad = await findeDatei(kandidaten);

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

        // WICHTIG: Die Linien-Erkennung läuft bewusst bei 1754px Breite –
        // das ist exakt die Auflösung, die auf speiseplan-ansicht.html für
        // den grünen Rahmen bereits zuverlässig getestet ist. Bei der
        // höheren 3200px-Auflösung (nur für die eigentliche OCR-Bildschärfe
        // gedacht) hat sich die Linien-Erkennung als weniger zuverlässig
        // gezeigt und konnte in Einzelfällen eine falsche Zeile treffen.
        stufe = 'Seite 1 rendern (Analyse)';
        const seite1Analyse = await rendereSeite(pdfDokument, 1, 1754);

        stufe = 'Tabellenraster erkennen';
        const linienYAnalyse = findeLinien(seite1Analyse, 'horizontal', 0.5, 130);
        const linienXAnalyse = findeLinien(seite1Analyse, 'vertikal', 0.5, 130);

        if (linienYAnalyse.length < 7 || linienXAnalyse.length < 4) {
            throw new Error('Tabellenraster auf Seite 1 nicht wie erwartet erkannt (Linien Y: ' +
                linienYAnalyse.length + ', X: ' + linienXAnalyse.length + ')');
        }

        stufe = 'Seite 1 rendern (hohe Auflösung für OCR)';
        const seite1 = await rendereSeite(pdfDokument, 1, 3200);

        // Die bei 1754px gefundenen Positionen auf die 3200px-Version
        // hochrechnen (gleiches Prinzip wie bei der Rahmen-Skalierung
        // auf speiseplan-ansicht.html)
        const hochSkala = seite1.width / seite1Analyse.width;
        const linienY = linienYAnalyse.map(y => y * hochSkala);
        const linienX = linienXAnalyse.map(x => x * hochSkala);

        const zeileStart = linienY[1 + wochentagIndex];
        const zeileEnde  = linienY[2 + wochentagIndex];

        let seite2 = null;
        let linienY2 = null, linienX2 = null;
        if (pdfDokument.numPages > 1) {
            stufe = 'Seite 2 (Bilder) rendern';
            seite2 = await rendereSeite(pdfDokument, 2, 1754);
            linienY2 = findeLinien(seite2, 'horizontal', 0.5, 100);
            linienX2 = findeLinien(seite2, 'vertikal', 0.5, 100);

            // Plausibilitäts-Check: Liegt die gewählte Zeile auf Seite 1
            // (prozentual zur Seitenhöhe) etwa an derselben Stelle wie auf
            // Seite 2? Große Abweichung deutet auf eine falsch erkannte
            // Zeile hin (z. B. durch eine zusätzliche Fehl-Linie auf einer
            // der beiden Seiten).
            if (linienY2 && linienY2.length >= 7) {
                const mitteSeite1 = ((zeileStart + zeileEnde) / 2) / seite1.height;
                const by0Check = linienY2[1 + wochentagIndex];
                const by1Check = linienY2[2 + wochentagIndex];
                if (by0Check !== undefined && by1Check !== undefined) {
                    const mitteSeite2 = ((by0Check + by1Check) / 2) / seite2.height;
                    const abweichung = Math.abs(mitteSeite1 - mitteSeite2);
                    if (abweichung > 0.08) {
                        console.warn(
                            'Plausibilitäts-Warnung: Zeilen-Position auf Seite 1 (' +
                            (mitteSeite1 * 100).toFixed(1) + '%) weicht deutlich von Seite 2 (' +
                            (mitteSeite2 * 100).toFixed(1) + '%) ab – möglicherweise falsche Zeile erkannt.'
                        );
                    }
                }
            }
        }

        stufe = 'Texterkennung (OCR)';
        const worker = await Tesseract.createWorker('deu');
        // PSM 6 = "Ein einzelner, gleichmäßiger Textblock" – passend für
        // eine kleine, isolierte Tabellenzelle statt einer ganzen Seite.
        await worker.setParameters({ tessedit_pageseg_mode: '6' });

        const spaltenGrenzen = [linienX[0], linienX[1], linienX[2], linienX[3]];

        for (let spalte = 0; spalte < 3; spalte++) {
            const x0 = spaltenGrenzen[spalte];
            const x1 = spaltenGrenzen[spalte + 1];

            const zelleRoh = schneideZu(seite1, x0, zeileStart, x1 - x0, zeileEnde - zeileStart);
            const zelleSw  = schwarzWeiss(zelleRoh);

            const { data } = await worker.recognize(zelleSw);
            const text = bereinigeText(data.text);

            const karte = kartenWrap.children[spalte];
            karte.querySelector('.sp-heute-spalten-name').textContent = SPALTEN_LABEL[spalte] || '';
            karte.querySelector('.sp-heute-text').textContent = text || '(nicht erkannt)';

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

document.addEventListener('DOMContentLoaded', () => {
    let letzterZielTag = effektivesZiel().ziel.toDateString();
    start();

    // Alle 5 Minuten prüfen, ob sich der effektive Zieltag geändert hat
    // (z. B. weil es 15:00 Uhr oder Mitternacht wurde). Nur in diesem
    // Fall wird die komplette Erkennung neu durchlaufen – nicht bei
    // jeder Prüfung, um unnötige OCR-Läufe zu vermeiden.
    setInterval(() => {
        const neuerZielTag = effektivesZiel().ziel.toDateString();
        if (neuerZielTag !== letzterZielTag) {
            letzterZielTag = neuerZielTag;
            start();
        }
    }, 5 * 60 * 1000);
});
