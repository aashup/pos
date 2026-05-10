FROM php:8.4-cli-alpine

# System dependencies
RUN apk add --no-cache \
    git \
    curl \
    zip \
    unzip \
    linux-headers \
    unixodbc \
    unixodbc-dev \
    $PHPIZE_DEPS

# PHP extensions
RUN docker-php-ext-install pdo pdo_mysql pcntl bcmath

# ODBC extension (Alpine: extract source, patch configure to suppress auto-enable of unintended ODBC backends)
RUN set -eux; \
    docker-php-source extract; \
    cd /usr/src/php/ext/odbc; \
    phpize; \
    sed -ri 's@^ *test +"\$PHP_.*" *= *"no" *&& *PHP_.*=yes *$@#&@g' configure; \
    ./configure --prefix=/usr/local --with-unixODBC=shared,/usr; \
    make -j "$(nproc)"; \
    make install; \
    docker-php-ext-enable odbc; \
    docker-php-source delete

# Redis extension
RUN pecl install redis && docker-php-ext-enable redis

# Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

EXPOSE 8000

CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
