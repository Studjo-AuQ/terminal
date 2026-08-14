#!/usr/bin/env python3
"""
Erzeugt data/losungen.json aus der offiziellen Jahres-XML-Datei
der Herrnhuter Brüdergemeine (losungen.de).

Erwartetes Quellformat (ein <Losungen>-Block pro Tag, beliebig oft
im Dokument vorhanden, unabhängig vom Namen des umschließenden
Wurzelelements):

    <Losungen>
      <Datum>2026-01-01T00:00:00.000</Datum>
      <Wtag>Donnerstag</Wtag>
      <Sonntag>Neujahr</Sonntag>          (optional, nicht an jedem Tag vorhanden)
      <Losungstext>...</Losungstext>
      <Losungsvers>Jesaja 25,8</Losungsvers>
      <Lehrtext>...</Lehrtext>
      <Lehrtextvers>1. Johannes 4,9</Lehrtextvers>
    </Losungen>

Aufruf:
    python3 scripts/build_losungen_json.py <quelldatei.xml> data/losungen.json
"""

import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def parse_eintraege(dateipfad: str) -> dict:
    ergebnis = {}

    baum = ET.parse(dateipfad)
    wurzel = baum.getroot()

    # root.iter() findet <Losungen>-Blöcke unabhängig vom Namen
    # des umschließenden Wurzelelements und der Verschachtelungstiefe.
    for eintrag in wurzel.iter("Losungen"):
        datum_roh = eintrag.findtext("Datum")
        if not datum_roh:
            continue

        # "2026-01-01T00:00:00.000" -> "2026-01-01"
        datum_iso = datum_roh.strip().split("T")[0]

        sonntag = (eintrag.findtext("Sonntag") or "").strip()

        ergebnis[datum_iso] = {
            "wochentag": (eintrag.findtext("Wtag") or "").strip(),
            "sonntag": sonntag,  # z.B. "Neujahr", leerer String an gewöhnlichen Tagen
            "losung": (eintrag.findtext("Losungstext") or "").strip(),
            "losung_stelle": (eintrag.findtext("Losungsvers") or "").strip(),
            "lehrtext": (eintrag.findtext("Lehrtext") or "").strip(),
            "lehrtext_stelle": (eintrag.findtext("Lehrtextvers") or "").strip(),
        }

    return ergebnis


def main():
    if len(sys.argv) != 3:
        print("Nutzung: build_losungen_json.py <quelldatei.xml> <zieldatei.json>")
        sys.exit(1)

    quelldatei = sys.argv[1]
    zieldatei = Path(sys.argv[2])

    daten = parse_eintraege(quelldatei)

    if not daten:
        print("WARNUNG: Es wurden keine Einträge gefunden. "
              "Bitte Struktur der Quelldatei prüfen (Tag-Name <Losungen> erwartet).")
        sys.exit(1)

    zieldatei.parent.mkdir(parents=True, exist_ok=True)
    with open(zieldatei, "w", encoding="utf-8") as f:
        json.dump(daten, f, ensure_ascii=False, indent=2, sort_keys=True)

    print(f"{len(daten)} Losungen geschrieben nach {zieldatei}")


if __name__ == "__main__":
    main()
