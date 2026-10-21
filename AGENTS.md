# AGENTS.md – Studjo Terminal

## Projekt
GitHub-Pages-PWA „Terminal“ für Studjo | Arbeit und Qualifizierung.

## Arbeitsregeln
- Vor jeder Änderung immer die aktuelle Datei aus dem Repository lesen.
- Bestehende Dateinamen, Funktionen und Layouts erhalten, sofern die Aufgabe nichts anderes verlangt.
- Keine unnötigen Ordner, Umstrukturierungen oder Refactorings.
- Bilder/Icons nach `/img`, JSON nach `/data`, JavaScript nach `/js`, CSS nach `/css`.
- Mobile Nutzung hat hohe Priorität, besonders Android/Chrome.
- Bei PWA-Änderungen immer Manifest, Service Worker, Offline-Verhalten und Browser-Cache mitprüfen.
- Bei mehreren zusammengehörigen Änderungen alle betroffenen Dateien und Abhängigkeiten prüfen.
- JavaScript-Syntax, JSON und relevante GitHub-Actions-Logik vor Abschluss testen.
- Keine unrelated Design- oder Funktionsänderungen.

## Service Worker / Offline
- Der stabile App-Kern darf strikt precached werden.
- Rollierende Speiseplan-PDFs niemals wieder manuell nach Kalenderwochen in `OFFLINE_DATEIEN` eintragen.
- Speiseplan-PDFs werden dynamisch aus `data/speiseplan-kurz.json` synchronisiert.
- Änderungen an `sw.js` erfordern eine neue `CACHE_VERSION`.
- Network-first wird für häufig aktualisierte Startseiten-/Nachrichtenlogik verwendet; Cache bleibt Offline-Fallback.

## Tageskarte „Heute bei Studjo …“
- Maximal drei Inhalte.
- Schulferien dort grundsätzlich ignorieren.
- Schließungen, Feiertage und Brückentage sind geschützt und nicht verdrängbar.
- Mittagessen: bis 13:14 aktueller Tag; ab 13:15 Montag–Donnerstag Folgetag; Freitag nach 13:15 kein Essen-Tipp.
- AbA nur anzeigen, wenn das Angebot an diesem Tag tatsächlich stattfindet; direkt auf die Standort-Unterseite verlinken.
- Manuell hervorgehobene Nachrichten bleiben auf der Studjo-Plattform und öffnen `nachrichten-allgemein.html`.
- Nachrichten-Deep-Links primär über stabile RSS-ID; Titel nur als Fallback.
- Tageskarte bei relevanten Zeitgrenzen und bei Rückkehr in die App neu berechnen.

## Daten / Actions
- `data/speiseplan-kurz.json` wird durch `.github/workflows/speiseplan-kurz-update.yml` erzeugt.
- RSS-Fehler dürfen einen vorhandenen funktionierenden Nachrichtenbestand nicht durch eine leere Liste ersetzen.
- Ein grüner Workflow soll nur bedeuten, dass entweder frische Daten oder ein nachweislich brauchbarer letzter Stand vorhanden sind.

## Lokale Pflegezentrale
`Studjo-Pflegezentrale.html` ist normalerweise ein lokales Pflegewerkzeug und nicht Teil des Repositories. Wenn daran gearbeitet werden soll, muss die aktuelle Datei separat bereitgestellt werden.

## Ausgabe für den Nutzer
Wenn Dateien geändert werden, am Ende kurz und konkret nennen:
1. welche Dateien in GitHub ersetzt/neu hochgeladen werden,
2. in welcher Reihenfolge,
3. ob ein Service-Worker-/Cache-Wechsel zu beachten ist.
