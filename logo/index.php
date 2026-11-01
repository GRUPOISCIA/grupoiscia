<?php
/**
 * Entrega el logo vigente configurado desde el panel (botón "Cambiar logo").
 * Uso en la tienda:  <img src="/logo/" alt="Logo">
 * Vive en /logo/ (logo/index.php) y lee la carpeta uploads/ de la raíz.
 */
declare(strict_types=1);
require_once dirname(__DIR__) . '/config.php';

$ruta = null;
try {
    $pdo = new PDO(
        "mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4",
        $DB_USER,
        $DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $v = $pdo->query("SELECT v FROM panel_settings WHERE k = 'logo'")->fetchColumn();
    if (is_string($v) && strpos($v, 'uploads/') === 0) {
        $ruta = dirname(__DIR__) . '/uploads/' . basename($v);
    }
} catch (Throwable $e) {
    error_log('[logo.php] ' . $e->getMessage());
}

if (!$ruta || !is_file($ruta)) { http_response_code(404); exit; }

$tipos = ['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];
$ext = strtolower(pathinfo($ruta, PATHINFO_EXTENSION));
header('Content-Type: ' . ($tipos[$ext] ?? 'application/octet-stream'));
header('Cache-Control: public, max-age=300');
header('X-Content-Type-Options: nosniff');
readfile($ruta);
