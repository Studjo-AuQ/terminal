/* ══════════════════════════════════════════════════════
   kacheln.js – Kacheln auf der Startseite individuell anordnen
   Studjo Infoterminal | Evangelisches Johanneswerk

   Läuft nur dort, wo es ein .card-grid gibt (also nur auf
   index.html) – auf jeder anderen Seite tut diese Datei einfach
   nichts. Keine Änderung an der bestehenden Kachel-Liste in
   index.html nötig: die Reihenfolge/Sichtbarkeit wird rein per
   JavaScript auf die vorhandenen Elemente angewendet.

   Speicherung: ausschließlich lokal auf diesem Gerät
   (localStorage) – passt zum Grundsatz "offline, kein Account,
   keine Cloud". Auf einem geteilten Kiosk-Tablet gilt die zuletzt
   eingestellte Reihenfolge für alle, die das Gerät danach nutzen;
   das ist ohne ein Benutzerkonto-System nicht anders lösbar.

   Bedienung:
     - ✏️-Button (im Footer, neben dem QR-Code) schaltet den
       Anordnen-Modus ein/aus.
     - Im Anordnen-Modus bekommt jede Kachel ◀ (nach vorne),
       ✕ (ausblenden) und ▶ (nach hinten). Bereits ausgeblendete
       Kacheln werden im Anordnen-Modus gedimmt mit einem einzelnen
       "↺ Wieder anzeigen"-Button gezeigt.
     - Ein "Zurücksetzen"-Button (erscheint nur im Anordnen-Modus)
       stellt die ursprüngliche Reihenfolge/Sichtbarkeit wieder her.
   ══════════════════════════════════════════════════════ */

(function () {

  const REIHENFOLGE_SCHLUESSEL = 'studjo-kachel-reihenfolge';
  const AUSGEBLENDET_SCHLUESSEL = 'studjo-kachel-ausgeblendet';

  function starten() {
    const grid = document.querySelector('.card-grid');
    const toggleBtn = document.getElementById('kacheln-anordnen-btn');
    if (!grid || !toggleBtn) return; // nicht auf dieser Seite

    let bearbeitungsModus = false;

    function ladeListe(schluessel) {
      try {
        const roh = localStorage.getItem(schluessel);
        return roh ? JSON.parse(roh) : null;
      } catch (e) { return null; }
    }
    function speichereListe(schluessel, liste) {
      try { localStorage.setItem(schluessel, JSON.stringify(liste)); } catch (e) { /* localStorage evtl. blockiert - Änderung gilt dann nur bis zum Neuladen */ }
    }

    function alleKacheln() {
      return [...grid.querySelectorAll(':scope > a.card')];
    }

    /* Gespeicherte Reihenfolge anwenden: vorhandene Kacheln in der
       gemerkten Reihenfolge neu einsortieren. Kacheln, die (noch)
       nicht in der gemerkten Liste stehen - z. B. weil Marc später
       eine neue Kachel ergänzt hat - werden einfach hinten
       angehängt, in ihrer ursprünglichen Reihenfolge. */
    function wendeReihenfolgeAn() {
      const gemerkt = ladeListe(REIHENFOLGE_SCHLUESSEL);
      if (!gemerkt) return;
      const kacheln = alleKacheln();
      const nachHref = new Map(kacheln.map(k => [k.getAttribute('href'), k]));
      gemerkt.forEach(href => {
        const kachel = nachHref.get(href);
        if (kachel) { grid.appendChild(kachel); nachHref.delete(href); }
      });
      nachHref.forEach(kachel => grid.appendChild(kachel)); // neue, noch unbekannte Kacheln ans Ende
    }

    function wendeAusgeblendetAn() {
      const ausgeblendet = new Set(ladeListe(AUSGEBLENDET_SCHLUESSEL) || []);
      alleKacheln().forEach(kachel => {
        const href = kachel.getAttribute('href');
        kachel.style.display = (!bearbeitungsModus && ausgeblendet.has(href)) ? 'none' : '';
      });
    }

    function aktuelleReihenfolgeSpeichern() {
      speichereListe(REIHENFOLGE_SCHLUESSEL, alleKacheln().map(k => k.getAttribute('href')));
    }

    function kachelAusblenden(href) {
      const liste = ladeListe(AUSGEBLENDET_SCHLUESSEL) || [];
      if (!liste.includes(href)) liste.push(href);
      speichereListe(AUSGEBLENDET_SCHLUESSEL, liste);
    }
    function kachelEinblenden(href) {
      const liste = (ladeListe(AUSGEBLENDET_SCHLUESSEL) || []).filter(h => h !== href);
      speichereListe(AUSGEBLENDET_SCHLUESSEL, liste);
    }
    function istAusgeblendet(href) {
      return (ladeListe(AUSGEBLENDET_SCHLUESSEL) || []).includes(href);
    }

    function steuerungsKnopf(symbol, label) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = symbol;
      btn.setAttribute('aria-label', label);
      btn.style.cssText =
        'pointer-events:auto; border:none; border-radius:8px; background:rgba(255,255,255,0.92);' +
        'color:#0f2f37; font-size:1.05rem; font-weight:800; cursor:pointer; padding:6px 10px; line-height:1;' +
        'box-shadow:0 2px 6px rgba(0,0,0,0.25);';
      return btn;
    }

    /* Zeichnet die Bedienelemente einer einzelnen Kachel im
       Anordnen-Modus (oder entfernt sie wieder, wenn der Modus
       verlassen wird). */
    function kachelSteuerungAktualisieren(kachel, index, anzahl) {
      const bestehend = kachel.querySelector(':scope > .kachel-steuerung');
      if (bestehend) bestehend.remove();
      if (!bearbeitungsModus) {
        kachel.style.opacity = '';
        kachel.style.outline = '';
        return;
      }

      const href = kachel.getAttribute('href');
      const leiste = document.createElement('div');
      leiste.className = 'kachel-steuerung';
      leiste.style.cssText =
        'position:absolute; inset:0; display:flex; align-items:center; justify-content:center;' +
        'gap:8px; background:rgba(15,47,55,0.55); border-radius:inherit; z-index:5;';

      kachel.style.position = 'relative';
      kachel.style.outline = '2px dashed rgba(182,31,41,0.6)';

      if (istAusgeblendet(href)) {
        kachel.style.opacity = '.45';
        const wiederBtn = steuerungsKnopf('↺ Wieder anzeigen', 'Kachel wieder einblenden');
        wiederBtn.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          kachelEinblenden(href);
          alleAktualisieren();
        });
        leiste.appendChild(wiederBtn);
      } else {
        kachel.style.opacity = '';
        const linksBtn = steuerungsKnopf('◀', 'Kachel nach vorne verschieben');
        const entfernenBtn = steuerungsKnopf('✕', 'Kachel ausblenden');
        const rechtsBtn = steuerungsKnopf('▶', 'Kachel nach hinten verschieben');

        linksBtn.disabled = index === 0;
        rechtsBtn.disabled = index === anzahl - 1;
        [linksBtn, rechtsBtn].forEach(b => { if (b.disabled) b.style.opacity = '.4'; });

        linksBtn.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          const vorherige = kachel.previousElementSibling;
          if (vorherige) { grid.insertBefore(kachel, vorherige); aktuelleReihenfolgeSpeichern(); alleAktualisieren(); }
        });
        rechtsBtn.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          const naechste = kachel.nextElementSibling;
          if (naechste) { grid.insertBefore(naechste, kachel); aktuelleReihenfolgeSpeichern(); alleAktualisieren(); }
        });
        entfernenBtn.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          kachelAusblenden(href);
          alleAktualisieren();
        });

        leiste.appendChild(linksBtn);
        leiste.appendChild(entfernenBtn);
        leiste.appendChild(rechtsBtn);
      }

      kachel.appendChild(leiste);
    }

    function alleAktualisieren() {
      wendeAusgeblendetAn();
      const kacheln = alleKacheln();
      kacheln.forEach((kachel, i) => kachelSteuerungAktualisieren(kachel, i, kacheln.length));
    }

    /* ── Obere Leiste: Fertig + Zurücksetzen (nur im Anordnen-Modus) ── */
    let aktionsLeiste = null;
    function aktionsLeisteAnzeigen() {
      if (aktionsLeiste) return;
      aktionsLeiste = document.createElement('div');
      aktionsLeiste.style.cssText =
        'display:flex; justify-content:center; gap:14px; margin:0 0 14px;';

      const hinweis = document.createElement('div');
      hinweis.textContent = 'Anordnen-Modus: Kacheln verschieben oder ausblenden, dann "Fertig" antippen.';
      hinweis.style.cssText =
        'width:100%; text-align:center; font-size:0.85rem; color:#0f2f37; background:#fff3d6;' +
        'border:1px solid #e8d27a; border-radius:10px; padding:10px 14px; margin-bottom:10px;';

      const zuruecksetzenBtn = document.createElement('button');
      zuruecksetzenBtn.type = 'button';
      zuruecksetzenBtn.textContent = '↺ Zurücksetzen';
      zuruecksetzenBtn.style.cssText =
        'background:#f1f1f1; color:#0f2f37; border:none; border-radius:999px; padding:10px 20px;' +
        'font-size:0.95rem; font-weight:700; cursor:pointer;';
      zuruecksetzenBtn.addEventListener('click', () => {
        try {
          localStorage.removeItem(REIHENFOLGE_SCHLUESSEL);
          localStorage.removeItem(AUSGEBLENDET_SCHLUESSEL);
        } catch (e) {}
        location.reload();
      });

      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'display:flex; flex-direction:column; align-items:center;';
      wrapper.appendChild(hinweis);
      wrapper.appendChild(zuruecksetzenBtn);
      aktionsLeiste = wrapper;
      grid.parentNode.insertBefore(aktionsLeiste, grid);
    }
    function aktionsLeisteEntfernen() {
      if (aktionsLeiste) { aktionsLeiste.remove(); aktionsLeiste = null; }
    }

    toggleBtn.addEventListener('click', () => {
      bearbeitungsModus = !bearbeitungsModus;
      toggleBtn.setAttribute('aria-pressed', String(bearbeitungsModus));
      toggleBtn.textContent = bearbeitungsModus ? '✓' : '✏️';
      toggleBtn.setAttribute('aria-label', bearbeitungsModus ? 'Anordnen beenden' : 'Kacheln anordnen');
      if (bearbeitungsModus) aktionsLeisteAnzeigen(); else aktionsLeisteEntfernen();
      alleAktualisieren();
    });

    // Beim Laden: gespeicherte Reihenfolge/Sichtbarkeit sofort anwenden
    wendeReihenfolgeAn();
    wendeAusgeblendetAn();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', starten);
  } else {
    starten();
  }

})();
