<?php

$cachedConfig = __DIR__.'/../bootstrap/cache/config.php';

if (file_exists($cachedConfig)) {
    fwrite(
        STDERR,
        "Config cache detected. Refusing to run tests.\n".
        "Run: php artisan config:clear\n"
    );
    exit(1);
}

if (($_SERVER['APP_ENV'] ?? getenv('APP_ENV')) !== 'testing') {
    fwrite(STDERR, "Current environment: '".($_SERVER['APP_ENV'] ?? getenv('APP_ENV'))."'. Tests must run in 'testing' environment. There is an issue with APP_ENV variable.\n");
    exit(1);
}

$db = $_SERVER['DB_DATABASE'] ?? getenv('DB_DATABASE');

if ($db !== 'testing') {
    fwrite(
        STDERR,
        "Refusing to run tests on database: {$db}\n"
    );
    exit(1);
}

require __DIR__.'/../vendor/autoload.php';
