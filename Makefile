export UV_CACHE_DIR := $(CURDIR)/.cache/uv
export npm_config_cache := $(CURDIR)/.cache/npm
UV := uv run --frozen
WEB := npm --prefix apps/web

.PHONY: migrate setup check test-unit test-integration test-e2e build contracts contracts-check verify up down

setup:
	uv sync --frozen
	$(WEB) ci
	cd apps/web && npx playwright install chromium

migrate:
	$(UV) alembic upgrade head

contracts:
	$(UV) python -m scripts.export_openapi
	$(WEB) run contracts

contracts-check:
	$(MAKE) contracts
	git diff --exit-code -- contracts/openapi.json apps/web/src/api/generated.ts

check:
	$(UV) ruff check services scripts tests migrations
	$(UV) ruff format --check services scripts tests migrations
	$(UV) mypy
	$(UV) python scripts/check_function_lengths.py
	$(WEB) run check
	cd apps/web && node scripts/check-function-lengths.mjs

test-unit:
	$(UV) pytest tests/unit
	$(WEB) test

test-integration: migrate
	$(UV) pytest tests/integration

test-e2e:
	$(WEB) run test:e2e

build:
	$(UV) python -m build --no-isolation
	$(WEB) run build

verify:
	$(MAKE) contracts-check
	$(MAKE) check
	$(MAKE) test-unit
	$(MAKE) test-integration
	$(MAKE) test-e2e
	$(MAKE) build

up:
	docker compose up --build -d --wait

down:
	docker compose down
