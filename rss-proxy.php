<?php
/**
 * rss-proxy.php  –  Einfacher RSS-Proxy für Studjo Infoterminal
 *
 * Einbau: Diese Datei in denselben Ordner wie nachrichten.html legen.
 * In nachrichten.html dann setzen:
 *   const PHP_PROXY = 'rss-proxy.php';
 *
 * Der PHP-Proxy holt den RSS-Feed serverseitig (ohne Browsereinschränkungen)
 * und reicht ihn mit korrekten CORS-Headern an die HTML-Seite weiter.
 * Eine interne Cache-Datei verhindert zu viele Anfragen nach außen.
 */

// ── Erlaubte Quellen (Whitelist) ──────────────────────────
$ERLAUBTE_QUELLEN = [
    'https://www.tagesschau.de/einfache-sprache/index~rss2.xml',
    'https://www.nachrichtenleicht.de/nachrichten.2248.de.podcast.xml',
];

// ── Cache-Einstellungen ───────────────────────────────────
$CACHE_DATEI     = sys_get_temp_dir() . '/studjo_rss_cache.xml';
$CACHE_SEKUNDEN  = 900; // 15 Minuten

// ── CORS-Header setzen ────────────────────────────────────
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/xml; charset=utf-8');
header('X-Content-Type-Options: nosniff');

// ── URL prüfen ────────────────────────────────────────────
$url = isset($_GET['url']) ? trim($_GET['url']) : '';

if (!in_array($url, $ERLAUBTE_QUELLEN, true)) {
    http_response_code(403);
    echo '<?xml version="1.0"?><error>Quelle nicht erlaubt</error>';
    exit;
}

// ── Cache prüfen ─────────────────────────────────────────
if (file_exists($CACHE_DATEI) &&
    (time() - filemtime($CACHE_DATEI)) < $CACHE_SEKUNDEN) {
    readfile($CACHE_DATEI);
    exit;
}

// ── Feed holen ────────────────────────────────────────────
$kontext = stream_context_create([
    'http' => [
        'method'          => 'GET',
        'timeout'         => 10,
        'user_agent'      => 'Studjo-Infoterminal/1.0',
        'follow_location' => true,
    ],
    'ssl' => [
        'verify_peer'       => true,
        'verify_peer_name'  => true,
    ]
]);

$inhalt = @file_get_contents($url, false, $kontext);

if ($inhalt === false) {
    // Cache noch vorhanden? Dann lieber veraltet als gar nichts
    if (file_exists($CACHE_DATEI)) {
        readfile($CACHE_DATEI);
    } else {
        http_response_code(502);
        echo '<?xml version="1.0"?><error>Feed nicht erreichbar</error>';
    }
    exit;
}

// ── Speichern und ausgeben ───────────────────────────────
file_put_contents($CACHE_DATEI, $inhalt);
echo $inhalt;
