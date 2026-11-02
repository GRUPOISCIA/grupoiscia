<?php

declare(strict_types=1);



header('Content-Type: application/json; charset=utf-8');

header('Cache-Control: no-store, private');

header('X-Content-Type-Options: nosniff');



function respond(array $data, int $status = 200): never

{

    http_response_code($status);

    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    exit;

}



function base64UrlEncode(string $value): string

{

    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');

}



function requestJson(string $url, array $headers, ?string $body = null): array

{

    $handle = curl_init($url);

    if ($handle === false) {

        throw new RuntimeException('No fue posible iniciar la conexión con Google.');

    }



    curl_setopt_array($handle, [

        CURLOPT_RETURNTRANSFER => true,

        CURLOPT_HTTPHEADER => $headers,

        CURLOPT_CONNECTTIMEOUT => 5,

        CURLOPT_TIMEOUT => 15,

    ]);

    if ($body !== null) {

        curl_setopt($handle, CURLOPT_POSTFIELDS, $body);

    }



    $response = curl_exec($handle);

    $status = (int)curl_getinfo($handle, CURLINFO_RESPONSE_CODE);

    $curlError = curl_error($handle);

    curl_close($handle);



    if (!is_string($response) || $status < 200 || $status >= 300) {

        throw new RuntimeException('Error al consultar Google: ' . ($curlError !== '' ? $curlError : 'HTTP ' . $status));

    }



    $data = json_decode($response, true);

    if (!is_array($data)) {

        throw new RuntimeException('Google devolvió una respuesta inválida.');

    }



    return $data;

}



try {

    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {

        respond(['ok' => false, 'error' => 'Método no permitido.'], 405);

    }



    $propertyId = getenv('G-A4_PROPERTY_ID');

    $serviceAccountEmail = getenv('@grupoiscia.com');

    $privateKey = getenv('G-A4_PRIVATE_KEY');

    if (!is_string($propertyId) || !preg_match('/^\d+$/', $propertyId)

        || !is_string($serviceAccountEmail) || filter_var($serviceAccountEmail, FILTER_VALIDATE_EMAIL) === false

        || !is_string($privateKey) || trim($privateKey) === '') {

        respond([

            'ok' => false,

            'error' => 'GA4 no está configurado en el servidor.',

        ], 503);

    }



    $privateKey = str_replace('\\n', "\n", $privateKey);

    $issuedAt = time();

    $claims = [

        'iss' => $serviceAccountEmail,

        'scope' => 'https://www.googleapis.com/auth/analytics.readonly',

        'aud' => 'https://oauth2.googleapis.com/token',

        'iat' => $issuedAt,

        'exp' => $issuedAt + 3600,

    ];

    $unsignedToken = base64UrlEncode((string)json_encode(['alg' => 'RS256', 'typ' => 'JWT']))

        . '.' . base64UrlEncode((string)json_encode($claims));



    $key = openssl_pkey_get_private($privateKey);

    if ($key === false || !openssl_sign($unsignedToken, $signature, $key, OPENSSL_ALGO_SHA256)) {

        throw new RuntimeException('No fue posible firmar la solicitud de GA4.');

    }



    $jwt = $unsignedToken . '.' . base64UrlEncode($signature);

    $tokenResponse = requestJson('https://oauth2.googleapis.com/token', [

        'Content-Type: application/x-www-form-urlencoded',

    ], http_build_query([

        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',

        'assertion' => $jwt,

    ]));

    $accessToken = $tokenResponse['access_token'] ?? null;

    if (!is_string($accessToken) || $accessToken === '') {

        throw new RuntimeException('Google no devolvió un token de acceso.');

    }



    $report = requestJson(

        'https://analyticsdata.googleapis.com/v1beta/properties/' . $propertyId . ':runReport',

        [

            'Authorization: Bearer ' . $accessToken,

            'Content-Type: application/json',

        ],

        (string)json_encode([

            'dateRanges' => [['startDate' => 'today', 'endDate' => 'today']],

            'dimensions' => [['name' => 'pagePath']],

            'metrics' => [['name' => 'activeUsers']],

            'dimensionFilter' => [

                'filter' => [

                    'fieldName' => 'pagePath',

                    'stringFilter' => [

                        'matchType' => 'EXACT',

                        'value' => '/centro/',

                    ],

                ],

            ],

            'limit' => 1,

        ], JSON_UNESCAPED_SLASHES)

    );



    $activeUsers = (int)($report['rows'][0]['metricValues'][0]['value'] ?? 0);

    respond(['ok' => true, 'activeUsers' => $activeUsers]);

} catch (Throwable $error) {

    error_log('[GA4 visitantes del centro] ' . $error->getMessage());

    respond([

        'ok' => false,

        'error' => 'No fue posible consultar los visitantes de GA4. Revisa la configuración del servidor y el acceso de la cuenta a la propiedad.',

    ], 502);

}

