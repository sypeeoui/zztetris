<?php
declare(strict_types=1);

// Same-origin fallback proxy for the replay viewer.
//
// TETRA CHANNEL only allows CORS from https://tetr.io, so the browser cannot
// call it directly. The viewer tries the Tetra Stats bridge first and falls
// back here. Replay files are fetched from inoue.szy.lol, the same backend
// Tetra Stats uses.
//
// Actions:
//   ?action=user&user=<username>
//   ?action=records&user=<username>&gamemode=<league|40l|blitz>
//   ?action=replay&id=<replayid>

const CACHE_DIR = '/tmp/zztetris-tetrio-cache';
const USER_TTL = 300;
const RECORDS_TTL = 600;
const REPLAY_TTL = 3600;
const USER_AGENT = 'ZZTetrisReplayViewer/1.0 (+https://zztetris.suqi.eu)';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function fail(int $status, string $message): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(
        ['success' => false, 'error' => ['msg' => $message]],
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
    exit;
}

function respond(string $body, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo $body;
    exit;
}

function cache_path(string $key): string
{
    if (!is_dir(CACHE_DIR)) {
        @mkdir(CACHE_DIR, 0775, true);
    }
    return CACHE_DIR . '/' . hash('sha256', $key) . '.cache';
}

function cache_read(string $key, int $ttl): ?string
{
    $path = cache_path($key);
    if (!is_file($path)) {
        return null;
    }
    if (time() - (int) filemtime($path) > $ttl) {
        @unlink($path);
        return null;
    }
    $body = @file_get_contents($path);
    return $body === false ? null : $body;
}

function cache_write(string $key, string $body): void
{
    @file_put_contents(cache_path($key), $body, LOCK_EX);
}

function cleanup_cache(): void
{
    $files = glob(CACHE_DIR . '/*.cache');
    if ($files === false || count($files) < 200) {
        return;
    }
    $cutoff = time() - 86400;
    foreach ($files as $file) {
        if ((int) filemtime($file) < $cutoff) {
            @unlink($file);
        }
    }
}

function fetch_upstream(string $url): array
{
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' =>
                'User-Agent: ' . USER_AGENT . "\r\n" .
                "X-Session-ID: zztetris-replay-viewer\r\n" .
                "Accept: application/json, application/octet-stream, */*\r\n",
            'timeout' => 20,
            'ignore_errors' => true,
            'follow_location' => 1,
            'max_redirects' => 3,
        ],
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
        ],
    ]);
    $body = @file_get_contents($url, false, $context);
    $status = 0;
    if (
        isset($http_response_header[0]) &&
        preg_match('/\s(\d{3})\s/', $http_response_header[0], $match)
    ) {
        $status = (int) $match[1];
    }
    return [$status, $body === false ? '' : $body];
}

function looks_like_json(string $body): bool
{
    $trimmed = ltrim($body);
    return $trimmed !== '' && ($trimmed[0] === '{' || $trimmed[0] === '[');
}

$action = strtolower(trim((string) ($_GET['action'] ?? '')));
$user = trim((string) ($_GET['user'] ?? ''));
$gamemode = strtolower(trim((string) ($_GET['gamemode'] ?? '')));
$id = strtolower(trim((string) ($_GET['id'] ?? '')));

cleanup_cache();

if ($action === 'user' || $action === 'records') {
    if (
        $user === '' ||
        strlen($user) > 64 ||
        preg_match('/[\x00-\x1f\x7f\/?#]/', $user)
    ) {
        fail(400, 'Invalid username.');
    }
    $user = strtolower($user);

    if ($action === 'user') {
        $key = 'user:' . $user;
        $cached = cache_read($key, USER_TTL);
        if ($cached !== null) {
            respond($cached);
        }
        [$status, $body] = fetch_upstream(
            'https://ch.tetr.io/api/users/' . rawurlencode($user)
        );
        if ($status === 200 && looks_like_json($body)) {
            cache_write($key, $body);
            respond($body);
        }
        if ($status === 404) {
            respond(
                looks_like_json($body)
                    ? $body
                    : '{"success":false,"error":{"msg":"User not found."}}',
                404
            );
        }
        if ($status === 429) {
            fail(429, 'TETRA CHANNEL is rate-limiting requests. Try again shortly.');
        }
        fail(502, 'Could not reach TETRA CHANNEL.');
    }

    if (!in_array($gamemode, ['league', '40l', 'blitz'], true)) {
        fail(400, 'Unsupported gamemode.');
    }
    $key = 'records:' . $user . ':' . $gamemode;
    $cached = cache_read($key, RECORDS_TTL);
    if ($cached !== null) {
        respond($cached);
    }
    [$status, $body] = fetch_upstream(
        'https://ch.tetr.io/api/users/' . rawurlencode($user) .
        '/records/' . $gamemode . '/recent'
    );
    if ($status === 200 && looks_like_json($body)) {
        cache_write($key, $body);
        respond($body);
    }
    if ($status === 404) {
        respond(
            looks_like_json($body)
                ? $body
                : '{"success":false,"error":{"msg":"User not found."}}',
            404
        );
    }
    if ($status === 429) {
        fail(429, 'TETRA CHANNEL is rate-limiting requests. Try again shortly.');
    }
    fail(502, 'Could not reach TETRA CHANNEL.');
}

if ($action === 'replay') {
    if (!preg_match('/^[0-9a-f]{12,24}$/', $id)) {
        fail(400, 'Invalid replay ID.');
    }
    $key = 'replay:' . $id;
    $cached = cache_read($key, REPLAY_TTL);
    if ($cached !== null) {
        respond($cached);
    }
    [$status, $body] = fetch_upstream(
        'https://inoue.szy.lol/api/replay/' . rawurlencode($id)
    );
    if ($status === 200 && looks_like_json($body)) {
        cache_write($key, $body);
        respond($body);
    }
    if ($status === 404) {
        fail(404, 'Replay expired or unavailable.');
    }
    if ($status === 429) {
        fail(429, 'The replay service is rate-limiting requests. Try again shortly.');
    }
    fail(502, 'Could not reach the replay service.');
}

fail(400, 'Unknown action.');
