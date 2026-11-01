<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . "/config.php";
require_once dirname(__DIR__, 2) . "/envios_lib.php";
const DESTINATARIO = "ventas@grupoiscia.com";
function back(string $s): never
{
    header("Location: /contacto/?estado=" . $s);
    exit();
}
function clean(string $s): string
{
    return trim(strip_tags($s));
}
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    back("error");
}
if (!empty($_POST["website"] ?? "")) {
    back("ok");
}
$nombre = clean((string) ($_POST["nombre"] ?? ""));
$empresa = clean((string) ($_POST["empresa"] ?? ""));
$telefono = clean((string) ($_POST["telefono"] ?? ""));
$correo = trim((string) ($_POST["correo"] ?? ""));
$servicio = clean((string) ($_POST["servicio"] ?? ""));
$mensaje = trim(strip_tags((string) ($_POST["mensaje"] ?? "")));
$captcha = trim((string) ($_POST["g-recaptcha-response"] ?? ""));
if (
    !$nombre ||
    !$empresa ||
    !$telefono ||
    !$correo ||
    !$servicio ||
    !$mensaje ||
    !$captcha
) {
    back("datos");
}
if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
    back("correo");
}
if (!preg_match('/^\+?[0-9\s().-]{10,20}$/', $telefono)) {
    back("telefono");
}
foreach ([$nombre, $empresa, $telefono, $correo, $servicio] as $v) {
    if (preg_match('/[\r\n]/', $v)) {
        back("datos");
    }
}
// cPanel/Apache puede exponer SetEnv mediante $_SERVER en lugar de getenv().
$recaptchaSecret =
    getenv("RECAPTCHA_SECRET") ?:
    ($_SERVER["RECAPTCHA_SECRET"] ?? ($_ENV["RECAPTCHA_SECRET"] ?? ""));
if (!is_string($recaptchaSecret) || trim($recaptchaSecret) === "") {
    error_log("Falta configurar reCAPTCHA secret key.");
    back("recaptcha_config");
}
$recaptchaSecret = trim($recaptchaSecret);
$data = http_build_query([
    "secret" => $recaptchaSecret,
    "response" => $captcha,
    "remoteip" => $_SERVER["REMOTE_ADDR"] ?? "",
]);
$verify = false;
if (function_exists("curl_init")) {
    $ch = curl_init("https://www.google.com/recaptcha/api/siteverify");
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $data,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $verify = curl_exec($ch);
    curl_close($ch);
} else {
    $ctx = stream_context_create([
        "http" => [
            "method" => "POST",
            "header" => "Content-Type: application/x-www-form-urlencoded\r\n",
            "content" => $data,
            "timeout" => 12,
        ],
    ]);
    $verify = @file_get_contents(
        "https://www.google.com/recaptcha/api/siteverify",
        false,
        $ctx
    );
}
$r = json_decode((string) $verify, true);
if (!is_array($r) || empty($r["success"])) {
    error_log("reCAPTCHA rechazado: " . (string) $verify);
    back("recaptcha");
}
$escape = static fn(string $value): string => htmlspecialchars(
    $value,
    ENT_QUOTES | ENT_SUBSTITUTE,
    "UTF-8"
);
$cuerpo =
    "<h2>Nuevo mensaje desde el sitio web</h2>" .
    "<p><strong>Nombre:</strong> " . $escape($nombre) . "</p>" .
    "<p><strong>Empresa:</strong> " . $escape($empresa) . "</p>" .
    "<p><strong>Teléfono:</strong> " . $escape($telefono) . "</p>" .
    "<p><strong>Correo:</strong> " . $escape($correo) . "</p>" .
    "<p><strong>Servicio:</strong> " . $escape($servicio) . "</p>" .
    "<p><strong>Mensaje:</strong><br>" . nl2br($escape($mensaje), false) . "</p>" .
    "<hr><p><strong>Fecha:</strong> " . date("d/m/Y H:i:s") .
    "<br><strong>IP:</strong> " .
    $escape((string) ($_SERVER["REMOTE_ADDR"] ?? "No disponible")) .
    "</p>";
try {
    iscia_mail(
        DESTINATARIO,
        "Nuevo contacto web - " . $servicio,
        $cuerpo,
        $correo
    );
} catch (Throwable $e) {
    error_log("SMTP de contacto falló: " . $e->getMessage());
    back("mail");
}
back("ok");
