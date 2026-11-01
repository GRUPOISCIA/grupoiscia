<?php
/**
 * API de la tienda.
 *   GET  /api/pedidos/?a=catalogo   → productos publicados y ajustes públicos
 *   POST /api/pedidos/?a=pedido     → crea el pedido, reserva stock y devuelve el enlace de pago de Mercado Pago
 *   GET  /api/pedidos/?a=estado     → estado de un pedido (por token) al volver de Mercado Pago
 *   POST /api/pedidos/?a=webhook    → notificaciones de Mercado Pago (configúrala en tu aplicación de Mercado Pago)
 */
declare(strict_types=1);

require __DIR__ . '/lib.php';

header('X-Content-Type-Options: nosniff');

function salir(array $datos, int $codigo = 200): void {
    http_response_code($codigo);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($datos, JSON_UNESCAPED_UNICODE);
    exit;
}
function texto($v, int $max): string {
    return mb_substr(trim((string)preg_replace('/\s+/u', ' ', (string)$v)), 0, $max);
}

$accion = (string)($_GET['a'] ?? '');

try {
    db();
    asegurar_tablas();
} catch (Throwable $ex) {
    error_log('api.php conexión: ' . $ex->getMessage());
    if ($accion === 'webhook') { http_response_code(500); exit; }
    salir(['error' => 'La tienda no está disponible por el momento.'], 503);
}

switch ($accion) {

    // ---------------------------------------------------------------- catálogo
    case 'catalogo':
        $aj = ajustes();
        $tienda = [
            'nombre'             => $aj['tienda_nombre'] ?? 'Tienda',
            'envio_costo'        => (float)($aj['envio_costo'] ?? 0),
            'envio_gratis_desde' => (float)($aj['envio_gratis_desde'] ?? 0),
            'aviso'              => $aj['aviso'] ?? '',
            'whatsapp'           => $aj['whatsapp'] ?? '',
        ];
        if (($aj['tienda_activa'] ?? '1') !== '1') {
            salir(['activa' => false, 'tienda' => $tienda, 'productos' => []]);
        }
        $lista = [];
        foreach (rows('SELECT id, sku, nombre, descripcion, precio, stock, imagen, categoria, destacado FROM productos WHERE publicado = 1 ORDER BY destacado DESC, nombre') as $p) {
            $lista[] = [
                'id'          => (int)$p['id'],
                'sku'         => $p['sku'],
                'nombre'      => $p['nombre'],
                'descripcion' => (string)$p['descripcion'],
                'precio'      => (float)$p['precio'],
                'stock'       => max(0, (int)$p['stock']),
                'imagen'      => $p['imagen'] ? UPLOAD_URL . $p['imagen'] : null,
                'categoria'   => (string)$p['categoria'],
                'destacado'   => (int)$p['destacado'] === 1,
            ];
        }
        salir(['activa' => true, 'tienda' => $tienda, 'productos' => $lista]);

    // ---------------------------------------------------------------- crear pedido
    case 'pedido':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { salir(['error' => 'Método no permitido.'], 405); }
        $aj = ajustes();
        if (($aj['tienda_activa'] ?? '1') !== '1') { salir(['error' => 'La tienda no está recibiendo pedidos por ahora.'], 503); }

        $in = json_decode((string)file_get_contents('php://input'), true);
        if (!is_array($in)) { salir(['error' => 'Solicitud inválida.'], 400); }

        liberar_expirados();

        // Evita acaparar stock con muchos pedidos sin pagar desde la misma IP.
        $ip  = substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
        $cnt = row("SELECT COUNT(*) n FROM pedidos WHERE ip = ? AND estado = 'pendiente' AND creado > ?", [$ip, date('Y-m-d H:i:s', time() - 3600)]);
        if ((int)$cnt['n'] >= 4) {
            salir(['error' => 'Tienes varios pedidos pendientes de pago. Termina alguno o espera unos minutos.'], 429);
        }

        $c  = is_array($in['cliente'] ?? null) ? $in['cliente'] : [];
        $en = is_array($in['envio'] ?? null) ? $in['envio'] : [];
        $f  = is_array($in['factura'] ?? null) ? $in['factura'] : [];

        $nombre     = texto($c['nombre'] ?? '', 150);
        $email      = texto($c['email'] ?? '', 150);
        $telefono   = (string)preg_replace('/\D/', '', (string)($c['telefono'] ?? ''));
        $direccion  = texto($en['direccion'] ?? '', 200);
        $colonia    = texto($en['colonia'] ?? '', 100);
        $ciudad     = texto($en['ciudad'] ?? '', 100);
        $estadoMx   = texto($en['estado'] ?? '', 60);
        $cp         = (string)preg_replace('/\D/', '', (string)($en['cp'] ?? ''));
        $referencia = texto($en['referencias'] ?? '', 255);

        $errores = [];
        if (mb_strlen($nombre) < 3)                      { $errores[] = 'Escribe tu nombre completo.'; }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL))  { $errores[] = 'Escribe un correo válido.'; }
        if (strlen($telefono) !== 10)                    { $errores[] = 'El teléfono debe tener 10 dígitos.'; }
        if (mb_strlen($direccion) < 5)                   { $errores[] = 'Escribe la calle y el número de entrega.'; }
        if (mb_strlen($colonia) < 2)                     { $errores[] = 'Escribe la colonia.'; }
        if (mb_strlen($ciudad) < 2)                      { $errores[] = 'Escribe la ciudad o municipio.'; }
        if ($estadoMx === '')                            { $errores[] = 'Elige el estado.'; }
        if (strlen($cp) !== 5)                           { $errores[] = 'El código postal debe tener 5 dígitos.'; }

        $reqFactura = !empty($f['requiere']);
        $rfc = $razon = $regimen = $uso = $cpFiscal = null;
        if ($reqFactura) {
            $rfc      = mb_strtoupper(texto($f['rfc'] ?? '', 13));
            $razon    = texto($f['razon_social'] ?? '', 200);
            $regimen  = texto($f['regimen'] ?? '', 80);
            $uso      = texto($f['uso_cfdi'] ?? '', 80);
            $cpFiscal = (string)preg_replace('/\D/', '', (string)($f['cp_fiscal'] ?? ''));
            if (!preg_match('/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/u', $rfc)) { $errores[] = 'El RFC no es válido.'; }
            if (mb_strlen($razon) < 3)                                   { $errores[] = 'Escribe la razón social o nombre fiscal.'; }
            if ($regimen === '')                                         { $errores[] = 'Elige el régimen fiscal.'; }
            if ($uso === '')                                             { $errores[] = 'Elige el uso de CFDI.'; }
            if (strlen($cpFiscal) !== 5)                                 { $errores[] = 'El código postal fiscal debe tener 5 dígitos.'; }
        }

        $lineas = [];
        foreach ((is_array($in['items'] ?? null) ? $in['items'] : []) as $it) {
            if (!is_array($it)) { continue; }
            $idp = (int)($it['id'] ?? 0);
            if ($idp <= 0) { continue; }
            $lineas[$idp] = min(20, ($lineas[$idp] ?? 0) + max(1, (int)($it['cantidad'] ?? 1)));
        }
        if (!$lineas) { $errores[] = 'Tu carrito está vacío.'; }

        if ($errores) { salir(['error' => $errores[0]], 422); }
        ksort($lineas);

        $pdo = db();
        $pdo->beginTransaction();
        try {
            $detalle  = [];
            $subtotal = 0.0;
            foreach ($lineas as $productoId => $cant) {
                $pr = row('SELECT id, sku, nombre, descripcion, precio, costo, stock, imagen FROM productos WHERE id = ? AND publicado = 1 FOR UPDATE', [$productoId]);
                if (!$pr) { throw new RuntimeException('Un producto de tu carrito ya no está disponible.'); }
                if ($cant > (int)$pr['stock']) {
                    throw new RuntimeException('Solo quedan ' . (int)$pr['stock'] . ' unidades de "' . $pr['nombre'] . '".');
                }
                if ((float)$pr['precio'] <= 0) { throw new RuntimeException('"' . $pr['nombre'] . '" no está disponible para compra en línea.'); }
                $detalle[] = $pr + ['cantidad' => $cant, 'descripcion' => texto($pr['descripcion'] ?? $pr['nombre'] ?? 'Producto', 1000)];
                $subtotal += round((float)$pr['precio'] * $cant, 2);
            }
            $costoEnvio = (float)($aj['envio_costo'] ?? 0);
            $gratisDesde = (float)($aj['envio_gratis_desde'] ?? 0);
            $envio = ($gratisDesde > 0 && $subtotal >= $gratisDesde) ? 0.0 : $costoEnvio;
            $total = round($subtotal + $envio, 2);
            $token = bin2hex(random_bytes(16));

            $pdo->prepare('INSERT INTO pedidos (token, cliente_nombre, cliente_email, cliente_telefono, envio_direccion, envio_colonia, envio_ciudad, envio_estado, envio_cp, envio_referencias,
                    requiere_factura, factura_rfc, factura_razon, factura_regimen, factura_uso, factura_cp, subtotal, envio, total, ip)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
                ->execute([$token, $nombre, $email, $telefono, $direccion, $colonia, $ciudad, $estadoMx, $cp, $referencia !== '' ? $referencia : null,
                    $reqFactura ? 1 : 0, $rfc, $razon, $regimen, $uso, $cpFiscal, round($subtotal, 2), $envio, $total, $ip]);
            $pedidoId = (int)$pdo->lastInsertId();

            foreach ($detalle as $d) {
                $pdo->prepare('INSERT INTO pedido_items (pedido_id, producto_id, sku, nombre, cantidad, precio_unitario, costo_unitario) VALUES (?,?,?,?,?,?,?)')
                    ->execute([$pedidoId, $d['id'], $d['sku'], $d['nombre'], $d['cantidad'], $d['precio'], $d['costo']]);
                $pdo->prepare('UPDATE productos SET stock = stock - ? WHERE id = ?')->execute([$d['cantidad'], $d['id']]);
                $pdo->prepare("INSERT INTO movimientos (producto_id, tipo, cantidad, nota) VALUES (?, 'venta', ?, ?)")
                    ->execute([$d['id'], $d['cantidad'], folio($pedidoId) . ' (reservado, pendiente de pago)']);
            }
            $pdo->commit();
        } catch (RuntimeException $ex) {
            if ($pdo->inTransaction()) { $pdo->rollBack(); }
            salir(['error' => $ex->getMessage(), 'refrescar' => true], 409);
        } catch (Throwable $ex) {
            if ($pdo->inTransaction()) { $pdo->rollBack(); }
            error_log('api pedido: ' . $ex->getMessage());
            salir(['error' => 'No se pudo crear el pedido. Inténtalo de nuevo.'], 500);
        }

        try {
            $pref = crear_preferencia([
                'id' => $pedidoId, 'token' => $token, 'nombre' => $nombre, 'email' => $email, 'telefono' => $telefono,
                'cp' => $cp, 'direccion' => $direccion, 'envio' => $envio,
            ], $detalle);
            $url = (MP_MODO_PRUEBA && !empty($pref['sandbox_init_point'])) ? (string)$pref['sandbox_init_point'] : (string)($pref['init_point'] ?? '');
            if ($url === '') { throw new RuntimeException('Mercado Pago no devolvió el enlace de pago.'); }
            db()->prepare('UPDATE pedidos SET mp_preference_id = ? WHERE id = ?')->execute([(string)($pref['id'] ?? ''), $pedidoId]);
            salir(['ok' => true, 'url' => $url, 'folio' => folio($pedidoId)]);
        } catch (Throwable $ex) {
            error_log('api pedido ' . $pedidoId . ' preferencia: ' . $ex->getMessage());
            cancelar_pedido($pedidoId, 'cancelado', 'No se pudo crear el pago en Mercado Pago.');
            salir(['error' => 'No pudimos iniciar el pago. Inténtalo de nuevo en unos minutos.'], 502);
        }
        break;

    // ---------------------------------------------------------------- estado del pedido
    case 'estado':
        $token = (string)($_GET['token'] ?? '');
        if (!preg_match('/^[a-f0-9]{32}$/', $token)) { salir(['error' => 'Pedido no encontrado.'], 404); }
        $ped = row('SELECT id FROM pedidos WHERE token = ?', [$token]);
        if (!$ped) { salir(['error' => 'Pedido no encontrado.'], 404); }
        $pedidoId = (int)$ped['id'];

        // Sincroniza el pago por si el webhook aún no llega.
        $pay = (string)($_GET['payment_id'] ?? $_GET['collection_id'] ?? '');
        if (preg_match('/^\d{3,20}$/', $pay)) {
            try { procesar_pago($pay); } catch (Throwable $ex) { error_log('api estado: ' . $ex->getMessage()); }
        }
        // Si el cliente regresó sin completar el pago, libera el stock reservado.
        if (($_GET['resultado'] ?? '') === 'error') {
            $x = row('SELECT estado, mp_status FROM pedidos WHERE id = ?', [$pedidoId]);
            if ($x && $x['estado'] === 'pendiente' && !in_array((string)$x['mp_status'], ['approved', 'in_process', 'pending'], true)) {
                cancelar_pedido($pedidoId, 'cancelado', 'El cliente regresó sin completar el pago.');
            }
        }
        $x = row('SELECT estado, total, mp_status FROM pedidos WHERE id = ?', [$pedidoId]);
        salir(['folio' => folio($pedidoId), 'estado' => $x['estado'], 'total' => (float)$x['total'], 'mp_status' => $x['mp_status']]);

    // ---------------------------------------------------------------- webhook de Mercado Pago
    case 'webhook':
        $cuerpo = json_decode((string)file_get_contents('php://input'), true);
        $cuerpo = is_array($cuerpo) ? $cuerpo : [];
        $tipo = (string)($_GET['type'] ?? $_GET['topic'] ?? ($cuerpo['type'] ?? ''));
        $pid  = (string)($_GET['data_id'] ?? $_GET['id'] ?? ($cuerpo['data']['id'] ?? ''));
        if ($tipo !== 'payment' || !preg_match('/^\d{3,20}$/', $pid)) { http_response_code(200); echo 'ok'; exit; }
        if (!verificar_firma($pid)) { http_response_code(401); exit; }
        try {
            procesar_pago($pid);
        } catch (Throwable $ex) {
            error_log('webhook ' . $pid . ': ' . $ex->getMessage());
            http_response_code(500);   // Mercado Pago reintentará
            exit;
        }
        http_response_code(200);
        echo 'ok';
        exit;

    default:
        salir(['error' => 'Acción no válida.'], 404);
}
