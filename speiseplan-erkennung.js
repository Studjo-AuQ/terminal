/* ══════════════════════════════════════════════════════
   speiseplan-erkennung.js
   Studjo Terminal | Evangelisches Johanneswerk

   Gemeinsame Hilfsfunktionen zur Analyse der Speiseplan-PDFs.
   Die PDFs sind vollflächige Bilder (kein Text-Layer!) –
   daher wird hier NICHT gelesen, sondern die Tabellen-
   Rasterlinien werden per Bildanalyse gefunden. Da die
   Wochentage immer in fester Reihenfolge Montag–Freitag
   erscheinen, reicht das für die Zuordnung "welche Zeile
   ist heute" bereits vollständig aus – ganz ohne
   Texterkennung.
   ══════════════════════════════════════════════════════ */

window.SpeiseplanErkennung = (function () {

    /* Findet dunkle, durchgehende horizontale oder vertikale
       Linien in einem Canvas (Tabellenraster). Gibt die
       y- bzw. x-Positionen der gefundenen Linien zurück. */
    function findeLinien(canvas, achse, schwelle = 0.5, dunkelWert = 130) {
        const ctx = canvas.getContext('2d');
        const { width, height } = canvas;
        const bild = ctx.getImageData(0, 0, width, height).data;

        const laenge = achse === 'horizontal' ? height : width;
        const breite = achse === 'horizontal' ? width : height;
        const kandidaten = [];

        for (let i = 0; i < laenge; i++) {
            let dunkleAnzahl = 0;
            for (let j = 0; j < breite; j += 2) { // jeden 2. Pixel prüfen (Performance)
                const x = achse === 'horizontal' ? j : i;
                const y = achse === 'horizontal' ? i : j;
                const idx = (y * width + x) * 4;
                const grau = (bild[idx] + bild[idx + 1] + bild[idx + 2]) / 3;
                if (grau < dunkelWert) dunkleAnzahl++;
            }
            if (dunkleAnzahl > (breite / 2) * schwelle) {
                kandidaten.push(i);
            }
        }

        // Benachbarte Treffer zu einer Linie zusammenfassen
        const gruppen = [];
        kandidaten.forEach(pos => {
            const letzte = gruppen[gruppen.length - 1];
            if (letzte && pos - letzte[letzte.length - 1] <= 10) {
                letzte.push(pos);
            } else {
                gruppen.push([pos]);
            }
        });

        return gruppen.map(g => Math.round(g.reduce((a, b) => a + b, 0) / g.length));
    }

    /* Liefert den heutigen Wochentag als Index 0=Montag … 6=Sonntag */
    function heutigerWochentagIndex() {
        const tag = new Date().getDay(); // 0=Sonntag … 6=Samstag
        return (tag + 6) % 7; // umrechnen auf 0=Montag … 6=Sonntag
    }

    return { findeLinien, heutigerWochentagIndex };
})();
