<?php
/**
 * /api/banners/index.php
 * Devuelve en JSON la lista de imágenes que existan en /public_html/img/banners
 * Basta con subir o borrar imágenes en esa carpeta para actualizar el carrusel.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');

$raiz = rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), '/\\');
$candidatos = [
    $raiz . '/img/banners',
    dirname(__DIR__, 2) . '/img/banners',   // public_html/api/banners -> public_html/img/banners
];

$dir = null;
foreach ($candidatos as $c) {
    if ($c !== '/img/banners' && is_dir($c)) { $dir = $c; break; }
}

$exts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg'];
$items = [];

if ($dir !== null) {
    foreach (scandir($dir) ?: [] as $f) {
        if ($f === '' || $f[0] === '.') continue;
        $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
        $ruta = $dir . '/' . $f;
        if (!in_array($ext, $exts, true) || !is_file($ruta)) continue;
        $items[] = ['file' => $f, 'mtime' => (int)filemtime($ruta)];
    }
    usort($items, fn($a, $b) => strnatcasecmp($a['file'], $b['file']));
}

$banners = array_map(fn($i) => [
    'src' => '/img/banners/' . rawurlencode($i['file']) . '?v=' . $i['mtime'],
    'alt' => ucfirst(str_replace(['-', '_'], ' ', pathinfo($i['file'], PATHINFO_FILENAME))),
], $items);

echo json_encode(
    ['ok' => $dir !== null, 'banners' => $banners],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
);
