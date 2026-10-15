/* ══════════════════════════════════════════════════════
   feiertage.js – NRW-Feiertage, Brückentage, Studjo-Zusatztage
   Studjo Infoterminal | Evangelisches Johanneswerk

   Reine Berechnung, keine Darstellung, keine Netzwerk-Zugriffe.
   Wird von index.html (Zeitkachel: "Jetzt ist Feiertag …") UND
   von kalender.js (Kalender-Popup) gemeinsam genutzt – damit es
   nur EINE Stelle gibt, die weiß, was ein Feiertag ist.

   Einbindung auf jeder Seite, die Feiertage braucht, VOR dem
   jeweils eigenen Skript:
     <script src="feiertage.js"></script>

   Komplett rechnerisch (Oster-Formel nach Gauß) – keine
   Datumsliste, die von Hand gepflegt werden müsste, auch nicht
   für zukünftige Jahre.
   ══════════════════════════════════════════════════════ */

(function () {

  const WOCHENTAGE = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
  const MONATE = ['Januar','Februar','März','April','Mai','Juni','Juli','August',
                   'September','Oktober','November','Dezember'];

  function pad(n) { return String(n).padStart(2, '0'); }

  /* Datum des Ostersonntags für ein gegebenes Jahr (Gauß'sche
     Osterformel). Alle beweglichen Feiertage leiten sich davon ab. */
  function ostersonntag(jahr) {
    const a = jahr % 19;
    const b = Math.floor(jahr / 100);
    const c = jahr % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const monatIndex0 = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 2=März, 3=April
    const tag = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(jahr, monatIndex0, tag);
  }

  function tagePlus(basis, n) {
    const d = new Date(basis);
    d.setDate(d.getDate() + n);
    return d;
  }

  function datumSchluessel(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /* Die 11 gesetzlichen Feiertage in NRW. */
  function nrwFeiertage(jahr) {
    const ostern = ostersonntag(jahr);
    const liste = [
      [new Date(jahr, 0, 1),        'Neujahr'],
      [tagePlus(ostern, -2),        'Karfreitag'],
      [tagePlus(ostern, 1),         'Ostermontag'],
      [new Date(jahr, 4, 1),        'Tag der Arbeit'],
      [tagePlus(ostern, 39),        'Christi Himmelfahrt'],
      [tagePlus(ostern, 50),        'Pfingstmontag'],
      [tagePlus(ostern, 60),        'Fronleichnam'],
      [new Date(jahr, 9, 3),        'Tag der Deutschen Einheit'],
      [new Date(jahr, 10, 1),       'Allerheiligen'],
      [new Date(jahr, 11, 25),      '1. Weihnachtstag'],
      [new Date(jahr, 11, 26),      '2. Weihnachtstag'],
    ];
    const karte = new Map();
    liste.forEach(([datum, name]) => karte.set(datumSchluessel(datum), name));
    return karte;
  }

  /* Studjo-interne Zusatztage: rechtlich keine gesetzlichen
     Feiertage, werden aber von Studjo wie Feiertage behandelt
     (immer geschlossen, unabhängig vom Wochentag). */
  function studjoZusatzFeiertage(jahr) {
    const karte = new Map();
    karte.set(datumSchluessel(new Date(jahr, 11, 24)), 'Heiligabend');
    karte.set(datumSchluessel(new Date(jahr, 11, 31)), 'Silvester');
    return karte;
  }

  /* Brückentage, an denen Studjo ebenfalls grundsätzlich
     geschlossen ist: der Freitag nach Christi Himmelfahrt und der
     Freitag nach Fronleichnam (beide Feiertage fallen immer auf
     einen Donnerstag, der jeweilige Brückentag damit immer auf den
     Freitag danach). */
  function nrwBrueckentage(jahr) {
    const ostern = ostersonntag(jahr);
    const liste = [
      [tagePlus(ostern, 40), 'Brückentag nach Christi Himmelfahrt'],
      [tagePlus(ostern, 61), 'Brückentag nach Fronleichnam'],
    ];
    const karte = new Map();
    liste.forEach(([datum, name]) => karte.set(datumSchluessel(datum), name));
    return karte;
  }

  function istArbeitsfreierTag(datum) {
    const tag = datum.getDay();
    if (tag === 0 || tag === 6) return true;
    const schluessel = datumSchluessel(datum);
    const jahr = datum.getFullYear();
    return nrwFeiertage(jahr).has(schluessel) ||
           studjoZusatzFeiertage(jahr).has(schluessel) ||
           nrwBrueckentage(jahr).has(schluessel);
  }

  /* Nächster echter Arbeitstag ab einem gegebenen Datum – überspringt
     Wochenenden UND Feiertage/Brückentage/Zusatztage (z. B. nach
     Christi Himmelfahrt geht es nicht am Freitag weiter, sondern
     erst am Montag, weil der Freitag ebenfalls Brückentag ist). */
  function naechsterArbeitstag(von) {
    const d = new Date(von);
    do { d.setDate(d.getDate() + 1); } while (istArbeitsfreierTag(d));
    return d;
  }

  /* "Morgen" bzw. den Wochentagsnamen für ein Zieldatum relativ zu
     jetzt. */
  function tagBezeichnung(ziel, jetzt) {
    const heute0 = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate());
    const ziel0  = new Date(ziel.getFullYear(), ziel.getMonth(), ziel.getDate());
    const diffTage = Math.round((ziel0 - heute0) / 86400000);
    return diffTage === 1 ? 'Morgen' : WOCHENTAGE[ziel.getDay()];
  }

  /* Prüft, ob ein Datum ein (gesetzlicher ODER Studjo-interner)
     Feiertag oder ein Brückentag ist. Liefert null, wenn nicht. */
  function pruefeFeiertagOderBrueckentag(datum) {
    const schluessel = datumSchluessel(datum);
    const jahr = datum.getFullYear();

    const feiertage = nrwFeiertage(jahr);
    if (feiertage.has(schluessel)) {
      return { typ: 'feiertag', name: feiertage.get(schluessel), istWochenende: datum.getDay() === 0 || datum.getDay() === 6 };
    }
    const zusatz = studjoZusatzFeiertage(jahr);
    if (zusatz.has(schluessel)) {
      // Heiligabend/Silvester: IMMER mit Schließungs-Hinweis, auch am Wochenende.
      return { typ: 'feiertag', name: zusatz.get(schluessel), istWochenende: false };
    }
    const brueckentage = nrwBrueckentage(jahr);
    if (brueckentage.has(schluessel)) {
      return { typ: 'brueckentag', name: brueckentage.get(schluessel), istWochenende: false };
    }
    return null;
  }

  window.StudjoFeiertage = {
    WOCHENTAGE, MONATE, pad,
    ostersonntag, tagePlus, datumSchluessel,
    nrwFeiertage, studjoZusatzFeiertage, nrwBrueckentage,
    istArbeitsfreierTag, naechsterArbeitstag, tagBezeichnung,
    pruefeFeiertagOderBrueckentag,
  };

})();
