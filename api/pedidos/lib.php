<?php
/**
 * Funciones compartidas por panel.php y api.php.
 * No necesitas editar este archivo.
 */
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/config.php';
// Puente: este archivo usa constantes; el config.php de la raíz define variables.
foreach (['DB_HOST'=>$DB_HOST,'DB_NAME'=>$DB_NAME,'DB_USER'=>$DB_USER,'DB_PASS'=>$DB_PASS,
          'MP_ACCESS_TOKEN'=>(string)($MP_ACCESS_TOKEN ?? ''),'MP_WEBHOOK_SECRET'=>(string)($MP_WEBHOOK_SECRET ?? '')] as $k=>$v) {
    if (!defined($k)) define($k, $v);
}
if (!defined('MONEDA')) define('MONEDA', '$');
date_default_timezone_set('America/Mexico_City');

// ===================== Utilidades =====================
function e($v): string { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }
function money($n): string { return MONEDA . number_format((float)$n, 2); }
function folio(int $id): string { return 'PED-' . str_pad((string)$id, 5, '0', STR_PAD_LEFT); }

// ===================== Base de datos =====================
function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]
        );
        $pdo->exec("SET time_zone = '-06:00'");
    }
    return $pdo;
}
function rows(string $sql, array $args = []): array {
    $s = db()->prepare($sql);
    $s->execute($args);
    return $s->fetchAll();
}
function row(string $sql, array $args = []) {
    $s = db()->prepare($sql);
    $s->execute($args);
    return $s->fetch();
}
function col_existe(string $tabla, string $col): bool {
    $r = row('SELECT COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [$tabla, $col]);
    return (int)$r['n'] > 0;
}
function asegurar_col(string $tabla, string $col, string $def): void {
    if (!col_existe($tabla, $col)) { db()->exec("ALTER TABLE `$tabla` ADD COLUMN `$col` $def"); }
}

/** Crea las tablas y aplica las mejoras a instalaciones anteriores. Es seguro ejecutarla varias veces. */
function install(): void {
    $p = db();
    $p->exec("CREATE TABLE IF NOT EXISTS productos (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        sku VARCHAR(50) NOT NULL UNIQUE,
        nombre VARCHAR(150) NOT NULL,
        descripcion TEXT NULL,
        precio DECIMAL(12,2) NOT NULL DEFAULT 0,
        costo DECIMAL(12,2) NOT NULL DEFAULT 0,
        stock INT NOT NULL DEFAULT 0,
        stock_minimo INT NOT NULL DEFAULT 0,
        imagen VARCHAR(120) NULL,
        creado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_nombre (nombre)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    asegurar_col('productos', 'categoria', 'VARCHAR(80) NULL');
    asegurar_col('productos', 'publicado', 'TINYINT(1) NOT NULL DEFAULT 0');
    asegurar_col('productos', 'destacado', 'TINYINT(1) NOT NULL DEFAULT 0');

    $p->exec("CREATE TABLE IF NOT EXISTS ventas (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        producto_id INT UNSIGNED NULL,
        producto_nombre VARCHAR(150) NOT NULL,
        cantidad INT NOT NULL,
        precio_unitario DECIMAL(12,2) NOT NULL,
        costo_unitario DECIMAL(12,2) NOT NULL DEFAULT 0,
        total DECIMAL(12,2) NOT NULL,
        cliente VARCHAR(150) NULL,
        estado ENUM('completada','cancelada') NOT NULL DEFAULT 'completada',
        creado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_creado (creado),
        CONSTRAINT fk_ventas_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    asegurar_col('ventas', 'pedido_id', 'INT UNSIGNED NULL');
    asegurar_col('ventas', 'origen', "VARCHAR(10) NOT NULL DEFAULT 'panel'");

    $p->exec("CREATE TABLE IF NOT EXISTS movimientos (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        producto_id INT UNSIGNED NOT NULL,
        tipo ENUM('entrada','salida','venta','devolucion') NOT NULL,
        cantidad INT NOT NULL,
        nota VARCHAR(255) NULL,
        creado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_creado (creado),
        CONSTRAINT fk_mov_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $p->exec("CREATE TABLE IF NOT EXISTS ajustes (
        clave VARCHAR(50) NOT NULL PRIMARY KEY,
        valor TEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $defecto = [
        'tienda_nombre'      => 'Tienda Grupo ISCIA',
        'tienda_activa'      => '1',
        'envio_costo'        => '150',
        'envio_gratis_desde' => '2500',
        'aviso'              => '',
        'whatsapp'           => '529932581296',
    ];
    $ins = $p->prepare('INSERT IGNORE INTO ajustes (clave, valor) VALUES (?, ?)');
    foreach ($defecto as $k => $val) { $ins->execute([$k, $val]); }

    $p->exec("CREATE TABLE IF NOT EXISTS pedidos (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        token CHAR(32) NOT NULL UNIQUE,
        estado ENUM('pendiente','pagado','enviado','entregado','cancelado','expirado','reembolsado') NOT NULL DEFAULT 'pendiente',
        cliente_nombre VARCHAR(150) NOT NULL,
        cliente_email VARCHAR(150) NOT NULL,
        cliente_telefono VARCHAR(20) NOT NULL,
        envio_direccion VARCHAR(200) NOT NULL,
        envio_colonia VARCHAR(100) NOT NULL,
        envio_ciudad VARCHAR(100) NOT NULL,
        envio_estado VARCHAR(60) NOT NULL,
        envio_cp CHAR(5) NOT NULL,
        envio_referencias VARCHAR(255) NULL,
        requiere_factura TINYINT(1) NOT NULL DEFAULT 0,
        factura_rfc VARCHAR(13) NULL,
        factura_razon VARCHAR(200) NULL,
        factura_regimen VARCHAR(80) NULL,
        factura_uso VARCHAR(80) NULL,
        factura_cp CHAR(5) NULL,
        subtotal DECIMAL(12,2) NOT NULL,
        envio DECIMAL(12,2) NOT NULL DEFAULT 0,
        total DECIMAL(12,2) NOT NULL,
        stock_reservado TINYINT(1) NOT NULL DEFAULT 1,
        mp_preference_id VARCHAR(80) NULL,
        mp_payment_id VARCHAR(40) NULL,
        mp_status VARCHAR(30) NULL,
        guia VARCHAR(150) NULL,
        nota_interna TEXT NULL,
        ip VARCHAR(45) NULL,
        creado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        pagado_en DATETIME NULL,
        KEY idx_estado (estado),
        KEY idx_creado (creado),
        KEY idx_ip (ip)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $p->exec("CREATE TABLE IF NOT EXISTS pedido_items (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        pedido_id INT UNSIGNED NOT NULL,
        producto_id INT UNSIGNED NULL,
        sku VARCHAR(50) NOT NULL,
        nombre VARCHAR(150) NOT NULL,
        cantidad INT NOT NULL,
        precio_unitario DECIMAL(12,2) NOT NULL,
        costo_unitario DECIMAL(12,2) NOT NULL DEFAULT 0,
        CONSTRAINT fk_pi_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
        CONSTRAINT fk_pi_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

/** Ejecuta install() solo si la base todavía no tiene la estructura más reciente. */
function asegurar_tablas(): void {
    static $hecho = false;
    if ($hecho) { return; }
    $r = row("SELECT COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'stock_reservado'");
    if ((int)$r['n'] === 0) { install(); }
    $hecho = true;
}

// ===================== Ajustes de la tienda =====================
function ajustes(): array {
    $a = [];
    foreach (rows('SELECT clave, valor FROM ajustes') as $r) { $a[$r['clave']] = $r['valor']; }
    return $a;
}
function guardar_ajuste(string $clave, string $valor): void {
    db()->prepare('INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)')->execute([$clave, $valor]);
}

// ===================== Pedidos y stock =====================
/**
 * Cancela un pedido pendiente o pagado (aún no enviado): devuelve el stock reservado
 * y cancela las ventas asociadas. Devuelve false si el pedido no está en un estado cancelable.
 */
function cancelar_pedido(int $id, string $nuevo = 'cancelado', string $nota = ''): bool {
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $p = row('SELECT id, estado, stock_reservado FROM pedidos WHERE id = ? FOR UPDATE', [$id]);
        if (!$p || !in_array($p['estado'], ['pendiente', 'pagado'], true)) { $pdo->rollBack(); return false; }
        if ((int)$p['stock_reservado'] === 1) {
            foreach (rows('SELECT producto_id, cantidad FROM pedido_items WHERE pedido_id = ?', [$id]) as $it) {
                if ($it['producto_id']) {
                    $pdo->prepare('UPDATE productos SET stock = stock + ? WHERE id = ?')->execute([$it['cantidad'], $it['producto_id']]);
                    $pdo->prepare("INSERT INTO movimientos (producto_id, tipo, cantidad, nota) VALUES (?, 'devolucion', ?, ?)")
                        ->execute([$it['producto_id'], $it['cantidad'], folio($id) . ' ' . $nuevo]);
                }
            }
        }
        $pdo->prepare("UPDATE ventas SET estado = 'cancelada' WHERE pedido_id = ?")->execute([$id]);
        $pdo->prepare('UPDATE pedidos SET estado = ?, stock_reservado = 0, nota_interna = CONCAT_WS(CHAR(10), nota_interna, ?) WHERE id = ?')
            ->execute([$nuevo, $nota !== '' ? $nota : null, $id]);
        $pdo->commit();
        return true;
    } catch (Throwable $ex) {
        if ($pdo->inTransaction()) { $pdo->rollBack(); }
        error_log('cancelar_pedido ' . $id . ': ' . $ex->getMessage());
        return false;
    }
}

/** Libera el stock de pedidos que nadie pagó dentro del tiempo de reserva. */
function liberar_expirados(): void {
    try {
        $limite = date('Y-m-d H:i:s', time() - (RESERVA_MINUTOS + 15) * 60);
        foreach (rows("SELECT id FROM pedidos WHERE estado = 'pendiente' AND creado < ?", [$limite]) as $r) {
            cancelar_pedido((int)$r['id'], 'expirado', 'Expiró sin recibir el pago.');
        }
    } catch (Throwable $ex) {
        error_log('liberar_expirados: ' . $ex->getMessage());
    }
}

/** Marca un pedido como pagado y registra las ventas. Solo actúa una vez por pedido. */
function marcar_pagado(int $id, string $paymentId, string $mpStatus): void {
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $p = row('SELECT * FROM pedidos WHERE id = ? FOR UPDATE', [$id]);
        if (!$p || in_array($p['estado'], ['pagado', 'enviado', 'entregado', 'reembolsado'], true)) { $pdo->rollBack(); return; }

        $items = rows('SELECT * FROM pedido_items WHERE pedido_id = ?', [$id]);
        $reservado = (int)$p['stock_reservado'];
        $nota = null;

        if ($reservado === 0) {
            // El pago llegó después de expirar/cancelar: intentamos reservar de nuevo.
            $alcanza = true;
            foreach ($items as $it) {
                $s = $it['producto_id'] ? row('SELECT stock FROM productos WHERE id = ? FOR UPDATE', [$it['producto_id']]) : false;
                if (!$s || (int)$s['stock'] < (int)$it['cantidad']) { $alcanza = false; break; }
            }
            if ($alcanza) {
                foreach ($items as $it) {
                    $pdo->prepare('UPDATE productos SET stock = stock - ? WHERE id = ?')->execute([$it['cantidad'], $it['producto_id']]);
                    $pdo->prepare("INSERT INTO movimientos (producto_id, tipo, cantidad, nota) VALUES (?, 'venta', ?, ?)")
                        ->execute([$it['producto_id'], $it['cantidad'], folio($id) . ' (pago tardío)']);
                }
                $reservado = 1;
            } else {
                $nota = 'REVISAR: el pago se aprobó cuando el pedido ya estaba cancelado o expirado y no hay stock suficiente. Confirma existencias o reembolsa en Mercado Pago.';
            }
        }

        $pdo->prepare("UPDATE pedidos SET estado = 'pagado', mp_payment_id = ?, mp_status = ?, pagado_en = ?, stock_reservado = ?, nota_interna = CONCAT_WS(CHAR(10), nota_interna, ?) WHERE id = ?")
            ->execute([$paymentId, $mpStatus, date('Y-m-d H:i:s'), $reservado, $nota, $id]);

        $ins = $pdo->prepare("INSERT INTO ventas (producto_id, producto_nombre, cantidad, precio_unitario, costo_unitario, total, cliente, pedido_id, origen) VALUES (?,?,?,?,?,?,?,?,'web')");
        foreach ($items as $it) {
            $ins->execute([
                $it['producto_id'], $it['nombre'], $it['cantidad'], $it['precio_unitario'], $it['costo_unitario'],
                round((float)$it['precio_unitario'] * (int)$it['cantidad'], 2), $p['cliente_nombre'], $id,
            ]);
        }
        $pdo->commit();
    } catch (Throwable $ex) {
        if ($pdo->inTransaction()) { $pdo->rollBack(); }
        error_log('marcar_pagado ' . $id . ': ' . $ex->getMessage());
        throw $ex;
    }
}

function marcar_reembolsado(int $id, string $mpStatus): void {
    $p = row('SELECT estado FROM pedidos WHERE id = ?', [$id]);
    if (!$p || !in_array($p['estado'], ['pagado', 'enviado', 'entregado'], true)) { return; }
    db()->prepare("UPDATE pedidos SET estado = 'reembolsado', mp_status = ?, nota_interna = CONCAT_WS(CHAR(10), nota_interna, ?) WHERE id = ?")
        ->execute([$mpStatus, 'Mercado Pago reportó: ' . $mpStatus . '. El stock NO se devolvió automáticamente; ajústalo en Inventario si la mercancía regresó.', $id]);
    db()->prepare("UPDATE ventas SET estado = 'cancelada' WHERE pedido_id = ?")->execute([$id]);
}

// ===================== Mercado Pago =====================
function mp_configurado(): bool {
    return MP_ACCESS_TOKEN !== '' && MP_ACCESS_TOKEN !== 'APP_USR-tu-access-token';
}

function mp_request(string $metodo, string $ruta, ?array $cuerpo = null): array {
    if (!mp_configurado()) { throw new RuntimeException('Mercado Pago no está configurado (MP_ACCESS_TOKEN en config.php).'); }
    $ch = curl_init('https://api.mercadopago.com' . $ruta);
    $cab = ['Authorization: Bearer ' . MP_ACCESS_TOKEN, 'Content-Type: application/json'];
    if ($metodo === 'POST') { $cab[] = 'X-Idempotency-Key: ' . bin2hex(random_bytes(16)); }
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 25,
        CURLOPT_CUSTOMREQUEST  => $metodo,
        CURLOPT_HTTPHEADER     => $cab,
    ]);
    if ($cuerpo !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($cuerpo, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }
    $res  = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    if ($res === false) { throw new RuntimeException('No se pudo contactar a Mercado Pago: ' . $err); }
    $j = json_decode((string)$res, true);
    if ($code < 200 || $code >= 300 || !is_array($j)) {
        error_log("Mercado Pago $metodo $ruta [$code] $res");
        throw new RuntimeException('Mercado Pago rechazó la solicitud (HTTP ' . $code . ').');
    }
    return $j;
}

/** Crea la preferencia de pago (Checkout Pro) y devuelve la respuesta de Mercado Pago. */
function crear_preferencia(array $ped, array $items): array {
    if (strpos(SITE_URL, 'tudominio.com') !== false) { throw new RuntimeException('Configura SITE_URL en config.php.'); }
    $https = strpos(SITE_URL, 'https://') === 0;

    $lineas = [];
    foreach ($items as $it) {
        $l = [
            'id'          => (string)$it['sku'],
            'title'       => mb_substr((string)$it['nombre'], 0, 250),
            'quantity'    => (int)$it['cantidad'],
            'unit_price'  => round((float)$it['precio'], 2),
            'currency_id' => 'MXN',
        ];
        if (!empty($it['imagen']) && $https) { $l['picture_url'] = SITE_URL . '/' . UPLOAD_URL . $it['imagen']; }
        $lineas[] = $l;
    }
    if ((float)$ped['envio'] > 0) {
        $lineas[] = ['id' => 'ENVIO', 'title' => 'Costo de envío', 'quantity' => 1, 'unit_price' => round((float)$ped['envio'], 2), 'currency_id' => 'MXN'];
    }

    $partes = explode(' ', (string)$ped['nombre'], 2);
    $payer = ['name' => $partes[0], 'email' => $ped['email'], 'phone' => ['number' => $ped['telefono']],
              'address' => ['zip_code' => $ped['cp'], 'street_name' => $ped['direccion']]];
    if (!empty($partes[1])) { $payer['surname'] = $partes[1]; }

    $base = SITE_URL . '/tienda/?token=' . $ped['token'] . '&pago=';
    $cuerpo = [
        'items'                => $lineas,
        'payer'                => $payer,
        'back_urls'            => ['success' => $base . 'ok', 'pending' => $base . 'pendiente', 'failure' => $base . 'error'],
        'notification_url'     => SITE_URL . '/api/pedidos/?a=webhook',
        'external_reference'   => (string)$ped['id'],
        'expires'              => true,
        'expiration_date_from' => date('Y-m-d\TH:i:s.000P'),
        'expiration_date_to'   => date('Y-m-d\TH:i:s.000P', time() + RESERVA_MINUTOS * 60),
    ];
    if ($https) { $cuerpo['auto_return'] = 'approved'; }
    return mp_request('POST', '/checkout/preferences', $cuerpo);
}

/** Consulta un pago en Mercado Pago y actualiza el pedido. Devuelve el id del pedido o null. */
function procesar_pago(string $paymentId): ?int {
    $pay = mp_request('GET', '/v1/payments/' . rawurlencode($paymentId));
    $id  = (int)($pay['external_reference'] ?? 0);
    if ($id <= 0) { return null; }
    $p = row('SELECT id, total, estado FROM pedidos WHERE id = ?', [$id]);
    if (!$p) { return null; }

    $st = (string)($pay['status'] ?? '');
    if ($p['estado'] === 'pendiente' || $st === 'approved') {
        db()->prepare('UPDATE pedidos SET mp_payment_id = ?, mp_status = ? WHERE id = ?')->execute([$paymentId, $st, $id]);
    }
    if ($st === 'approved') {
        if ((float)($pay['transaction_amount'] ?? 0) + 0.009 < (float)$p['total']) {
            db()->prepare('UPDATE pedidos SET nota_interna = CONCAT_WS(CHAR(10), nota_interna, ?) WHERE id = ?')
                ->execute(['REVISAR: el pago ' . $paymentId . ' se aprobó por un monto menor al total del pedido.', $id]);
            return $id;
        }
        marcar_pagado($id, $paymentId, $st);
    } elseif ($st === 'refunded' || $st === 'charged_back') {
        marcar_reembolsado($id, $st);
    }
    return $id;
}

/** Valida la firma x-signature de las notificaciones (solo si definiste MP_WEBHOOK_SECRET). */
function verificar_firma(string $dataId): bool {
    if (MP_WEBHOOK_SECRET === '') { return true; }
    $sig = (string)($_SERVER['HTTP_X_SIGNATURE'] ?? '');
    $req = (string)($_SERVER['HTTP_X_REQUEST_ID'] ?? '');
    if ($sig === '') { return false; }
    $ts = '';
    $v1 = '';
    foreach (explode(',', $sig) as $parte) {
        $kv = explode('=', trim($parte), 2);
        if (count($kv) === 2) {
            if ($kv[0] === 'ts') { $ts = $kv[1]; }
            if ($kv[0] === 'v1') { $v1 = $kv[1]; }
        }
    }
    $manifiesto = 'id:' . strtolower($dataId) . ';request-id:' . $req . ';ts:' . $ts . ';';
    return hash_equals(hash_hmac('sha256', $manifiesto, MP_WEBHOOK_SECRET), $v1);
}
