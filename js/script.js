/* --- Globale Variablen --- */
let isSpeaking = false;
let aktuelleAussage = null; 

/* --- Event-Listener: Wartet, bis die Seite geladen ist, und verknüpft den Button --- */
document.addEventListener('DOMContentLoaded', () => {
    // Sucht den Vorlese-Button (anhand seiner Klasse)
    const readButton = document.querySelector('.btn-read-aloud');
    
    // Wenn der Button gefunden wurde, füge den Klick-Befehl hinzu
    if (readButton) {
        readButton.addEventListener('click', vorlesenUndMarkieren);
    }
});

function vorlesenUndMarkieren() {
    // 1. NEU: Prüfen, ob der Browser das Vorlesen überhaupt unterstützt
    if (!('speechSynthesis' in window)) {
        alert("Dein Browser unterstützt leider keine Sprachausgabe.");
        return;
    }

    // 2. Wenn bereits gesprochen wird -> abbrechen (Toggle-Funktion)
    if (isSpeaking || window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        entferneAlleMarkierungen();
        isSpeaking = false;
        return;
    }

    // 3. Neustart vorbereiten
    window.speechSynthesis.cancel();
    isSpeaking = true;

    const elementeZumVorlesen = [];

    // H1 einsammeln
    const h1 = document.querySelector('h1');
    if (h1 && h1.innerText.trim() !== "") {
        elementeZumVorlesen.push({ text: h1.innerText, element: h1 });
    }

    // Überleitung
    elementeZumVorlesen.push({ text: "Hier gibt es folgende Bereiche:", element: null });

    // Kacheln einsammeln
    const tiles = document.querySelectorAll('.tile');
    tiles.forEach(tile => {
        const h2 = tile.querySelector('h2');
        if (h2 && h2.innerText.trim() !== "") {
            elementeZumVorlesen.push({ text: h2.innerText, element: tile });
        }
    });

    // Starten, falls Elemente vorhanden sind
    if (elementeZumVorlesen.length > 0) {
        spieleSequenz(elementeZumVorlesen, 0);
    } else {
        isSpeaking = false;
    }
}

function spieleSequenz(elemente, index) {
    // Abbruchbedingung am Ende der Liste oder wenn manuell gestoppt wurde
    if (index >= elemente.length || !isSpeaking) {
        entferneAlleMarkierungen();
        isSpeaking = false;
        return; 
    }

    const abschnitt = elemente[index];
    
    aktuelleAussage = new SpeechSynthesisUtterance(abschnitt.text);
    aktuelleAussage.lang = 'de-DE';
    aktuelleAussage.rate = 0.9; 

    aktuelleAussage.onstart = () => {
        entferneAlleMarkierungen();
        if (abschnitt.element) {
            abschnitt.element.classList.add('is-reading');
        }
    };

    aktuelleAussage.onend = () => {
        // Kurze Pause zwischen den Sätzen für einen natürlicheren Redefluss
        setTimeout(() => {
            spieleSequenz(elemente, index + 1);
        }, 150);
    };

    aktuelleAussage.onerror = (event) => {
        // NEU: Ignoriere den absichtlichen Abbruch (interrupted), melde nur echte Fehler
        if (event.error !== 'interrupted' && event.error !== 'canceled') {
            console.error("Fehler beim Vorlesen:", event);
        }
        entferneAlleMarkierungen();
        isSpeaking = false;
    };

    window.speechSynthesis.speak(aktuelleAussage);
}

function entferneAlleMarkierungen() {
    document.querySelectorAll('.is-reading').forEach(el => {
        el.classList.remove('is-reading');
    });
}
