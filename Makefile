COMPOSE := docker compose -f api/docker-compose.yml

.PHONY: start rebuild rebuild-fe rebuild-api migrate migrate-fresh migrate-fresh-seed seed pint logs backend-log frontend-log stop down

# ─────────────────────────────────────────────
# Start — build images and bring all services up
# Live-edits in ./api and ./electron-app take effect immediately (bind mounts)
# ─────────────────────────────────────────────
start:
	$(COMPOSE) up -d

# ─────────────────────────────────────────────
# Rebuild — force-rebuild images, drop stale node_modules volume, restart
# ─────────────────────────────────────────────
rebuild:
	$(COMPOSE) rm -sf fe api
	$(COMPOSE) build --no-cache api
	$(COMPOSE) up -d

 

rebuild-api:
	$(COMPOSE) rm -sf api
	$(COMPOSE) build --no-cache api
	$(COMPOSE) up -d api

# ─────────────────────────────────────────────
# Dependencies
# ─────────────────────────────────────────────
install:
	$(COMPOSE) exec api composer install --no-interaction

# ─────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────
migrate:
	$(COMPOSE) exec api php artisan migrate

migrate-fresh:
	$(COMPOSE) exec api php artisan migrate:fresh

migrate-fresh-seed:
	$(COMPOSE) exec api php artisan migrate:fresh --seed

seed:
	$(COMPOSE) exec api php artisan db:seed

# ─────────────────────────────────────────────
# POS — reset local SQLite and re-seed backend
# ─────────────────────────────────────────────
pos-fresh:
	@powershell -Command "Get-ChildItem \"$$env:APPDATA\" -Recurse -Filter 'zazzy-pos.db' -ErrorAction SilentlyContinue | Remove-Item; Write-Host 'SQLite DB deleted — restart the Electron app'"

# ─────────────────────────────────────────────
# Code Quality
# ─────────────────────────────────────────────
pint:
	$(COMPOSE) exec api ./vendor/bin/pint

# ─────────────────────────────────────────────
# Logs
# ─────────────────────────────────────────────
logs:
	$(COMPOSE) logs -f api fe

backend-log:
	$(COMPOSE) logs -f api

frontend-log:
	$(COMPOSE) logs -f fe

# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────
stop:
	$(COMPOSE) stop

down:
	$(COMPOSE) down
