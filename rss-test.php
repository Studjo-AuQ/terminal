<?php
/**
 * rss-test.php  –  Diagnose-Tool für Studjo RSS-Proxy
 *
 * Aufruf im Browser: https://euer-server.de/pfad/rss-test.php
 * Danach die Ausgabe Marc oder IT-Abteilung zeigen.
 * NACH DEM TEST WIEDER LÖSCHEN (enthält interne Infos).
 */

header('Content-Type: text/html; charset=utf-8');

$TEST_URL = 'https://www.nachrichtenleicht.de/nachrichtenleicht-nachrichten-100.rss';

function ja_nein($wert) {
    return $wert
        ? '<span style="color:green;font-weight:bold">✅ JA</span>'
        : '<span style="color:red;font-weight:bold">❌ NEIN</span>';
}

function status($ok, $text) {
    $farbe = $ok ? '#d4edda' : '#f8d7da';
    $rand  = $ok ? '#c3e6cb' : '#f5c6cb';
    echo "<div style='background:$farbe;border:1px solid $rand;border-radius:6px;"
       . "padding:10px 14px;margin:8px 0;font-family:monospace;font-size:0.9rem;'>"
       . $text . "</div>";
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>RSS-Proxy Diagnose – Studjo</title>
<style>
    body { font-family: Calibri, sans-serif; max-width: 860px; margin: 30px auto; padding: 0 20px; color: #222; }
    h1   { color: #b61f29; }
    h2   { color: #333; border-bottom: 2px solid #eee; padding-bottom: 6px; margin-top: 28px; }
    table { border-collapse: collapse; width: 100%; margin: 10px 0; }
    td, th { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f5f5f5; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 0.88em; }
    .hinweis { background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 12px 16px; margin: 12px 0; }
</style>
</head>
<body>
<h1>🔍 RSS-Proxy Diagnose</h1>
<p>Test-URL: <code><?= htmlspecialchars($TEST_URL) ?></code></p>
<p style="color:#888;font-size:0.85rem;">⚠️ Diese Datei nach dem Test wieder vom Server löschen.</p>

<!-- ══════════════════════════════════════════
     1. PHP-KONFIGURATION
     ══════════════════════════════════════════ -->
<h2>1. PHP-Konfiguration</h2>
<table>
<tr><th>Einstellung</th><th>Wert</th><th>Bedeutung</th></tr>
<tr>
    <td>PHP-Version</td>
    <td><?= phpversion() ?></td>
    <td>–</td>
</tr>
<tr>
    <td>allow_url_fopen</td>
    <td><?= ja_nein(ini_get('allow_url_fopen')) ?></td>
    <td>Pflicht für file_get_contents auf externe URLs</td>
</tr>
<tr>
    <td>cURL vorhanden</td>
    <td><?= ja_nein(function_exists('curl_init')) ?></td>
    <td>Alternative zu file_get_contents</td>
</tr>
<tr>
    <td>openssl</td>
    <td><?= ja_nein(extension_loaded('openssl')) ?></td>
    <td>Pflicht für HTTPS-Verbindungen</td>
</tr>
<tr>
    <td>Temp-Verzeichnis</td>
    <td><code><?= sys_get_temp_dir() ?></code></td>
    <td>Für Cache-Datei</td>
</tr>
<tr>
    <td>Temp beschreibbar?</td>
    <td><?= ja_nein(is_writable(sys_get_temp_dir())) ?></td>
    <td>Pflicht für Cache</td>
</tr>
</table>

<!-- ══════════════════════════════════════════
     2. TEST: file_get_contents
     ══════════════════════════════════════════ -->
<h2>2. Verbindungstest: file_get_contents</h2>
<?php
if (!ini_get('allow_url_fopen')) {
    status(false, '❌ allow_url_fopen ist deaktiviert – file_get_contents kann keine externen URLs abrufen. '
        . 'Der aktuelle PHP-Proxy funktioniert damit nicht. → cURL-Version nötig.');
} else {
    $kontext = stream_context_create([
        'http' => ['method' => 'GET', 'timeout' => 8, 'user_agent' => 'Studjo-Test/1.0'],
        'ssl'  => ['verify_peer' => true]
    ]);
    $start   = microtime(true);
    $inhalt  = @file_get_contents($TEST_URL, false, $kontext);
    $dauer   = round((microtime(true) - $start) * 1000);
    $headers = $http_response_header ?? [];

    if ($inhalt === false) {
        $fehler = error_get_last();
        status(false, "❌ file_get_contents fehlgeschlagen nach {$dauer} ms<br>"
            . "Fehlermeldung: <code>" . htmlspecialchars($fehler['message'] ?? 'unbekannt') . "</code>");
    } else {
        $laenge    = strlen($inhalt);
        $istXML    = stripos(trim($inhalt), '<?xml') === 0 || stripos(trim($inhalt), '<rss') === 0;
        $istHTML   = stripos(trim($inhalt), '<!DOCTYPE') === 0 || stripos(trim($inhalt), '<html') === 0;
        $vorschau  = htmlspecialchars(substr(trim($inhalt), 0, 200));

        status($istXML, ($istXML ? "✅" : "⚠️") . " file_get_contents erfolgreich – {$laenge} Bytes in {$dauer} ms<br>"
            . "Inhalt-Typ: " . ($istXML ? "XML/RSS ✅" : ($istHTML ? "HTML ❌ (kein RSS!)" : "Unbekannt ⚠️")) . "<br>"
            . "Erste 200 Zeichen: <code>{$vorschau}</code>");
    }

    if (!empty($headers)) {
        echo "<details style='margin-top:8px'><summary style='cursor:pointer;color:#555'>HTTP-Antwort-Header anzeigen</summary><pre style='background:#f5f5f5;padding:10px;font-size:0.8rem'>";
        foreach ($headers as $h) echo htmlspecialchars($h) . "\n";
        echo "</pre></details>";
    }
}
?>

<!-- ══════════════════════════════════════════
     3. TEST: cURL
     ══════════════════════════════════════════ -->
<h2>3. Verbindungstest: cURL</h2>
<?php
if (!function_exists('curl_init')) {
    status(false, '❌ cURL ist nicht installiert oder deaktiviert.');
} else {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $TEST_URL,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_USERAGENT      => 'Studjo-Test/1.0',
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_HEADER         => false,
    ]);
    $start  = microtime(true);
    $inhalt = curl_exec($ch);
    $dauer  = round((microtime(true) - $start) * 1000);
    $info   = curl_getinfo($ch);
    $fehler = curl_error($ch);
    curl_close($ch);

    if ($inhalt === false || !empty($fehler)) {
        status(false, "❌ cURL fehlgeschlagen nach {$dauer} ms<br>"
            . "cURL-Fehler: <code>" . htmlspecialchars($fehler) . "</code><br>"
            . "HTTP-Code: <code>{$info['http_code']}</code>");
    } else {
        $laenge   = strlen($inhalt);
        $istXML   = stripos(trim($inhalt), '<?xml') === 0 || stripos(trim($inhalt), '<rss') === 0;
        $istHTML  = stripos(trim($inhalt), '<!DOCTYPE') === 0 || stripos(trim($inhalt), '<html') === 0;
        $vorschau = htmlspecialchars(substr(trim($inhalt), 0, 200));

        status($istXML, ($istXML ? "✅" : "⚠️") . " cURL erfolgreich – {$laenge} Bytes in {$dauer} ms<br>"
            . "HTTP-Code: <code>{$info['http_code']}</code> | "
            . "Content-Type: <code>" . htmlspecialchars($info['content_type']) . "</code><br>"
            . "Inhalt-Typ: " . ($istXML ? "XML/RSS ✅" : ($istHTML ? "HTML ❌ (kein RSS!)" : "Unbekannt ⚠️")) . "<br>"
            . "Erste 200 Zeichen: <code>{$vorschau}</code>");
    }
}
?>

<!-- ══════════════════════════════════════════
     4. ZUSAMMENFASSUNG
     ══════════════════════════════════════════ -->
<h2>4. Was tun?</h2>
<div class="hinweis">
<strong>Die Ergebnisse oben zeigen, welche nächste Lösung passt:</strong><br><br>
<b>Wenn file_get_contents ❌ und cURL ✅ (XML)</b> →
    <code>rss-proxy.php</code> auf cURL umstellen (neue Version anfordern)<br><br>
<b>Wenn file_get_contents ✅ und cURL ✅ aber Inhalt ist HTML</b> →
    Die RSS-URL wurde verändert oder der Server gibt eine Weiterleitungsseite zurück<br><br>
<b>Wenn file_get_contents ❌ und cURL ❌</b> →
    Ausgehende Verbindungen sind vollständig blockiert → IT-Abteilung muss
    entweder die URL freischalten oder einen internen Feed-Cache einrichten<br><br>
<b>Wenn allow_url_fopen ❌ und cURL ✅ (XML)</b> →
    cURL-Proxy ist die Lösung
</div>

<p style="margin-top:30px;font-size:0.8rem;color:#aaa;">
    Studjo Infoterminal – Diagnose-Tool | Bitte nach dem Test löschen
</p>
</body>
</html>
