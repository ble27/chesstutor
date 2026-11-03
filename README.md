# Chess Tutor

Free, independent review of completed public Chess.com games. The product plan
combines Stockfish analysis, replay for both players, and chess-only guidance.

Sprint 1 adds public username/month lookup, monthly filtering and pagination,
and validated, versioned game import to the Sprint 0 foundation. S2 adds exact
both-player replay; its required manual acceptance remains pending. Engine
execution, labels, and coaching remain S3–S5 work.

- [PRD and sequential sprint gates](docs/PRD.md)
- [Sprint 0 evidence](docs/sprints/S0.md)
- [Sprint 1 evidence](docs/sprints/S1.md)
- [Sprint 2 implementation and acceptance status](docs/sprints/S2.md)
- [Integration research](docs/research.md)
- [Contributor conventions](AGENTS.md)

## Local setup

Use Python **3.14.7**, Node **24.6.0**, npm **11.5.1**, uv **0.11.2**, and Docker
Desktop/Engine with Compose. Toolchain files and both lockfiles are tracked.

```sh
make setup
docker compose up -d --wait postgres redis
make verify
```

`make setup` installs locked dependencies and the Playwright Chromium browser.
Linux may also need `cd apps/web && npx playwright install --with-deps chromium`.
The gate needs the local PostgreSQL/Redis services, but no Chess.com or AI calls.

Run the entire development stack:

```sh
make up
```

Open http://localhost:5173. FastAPI health endpoints are at
http://localhost:8000/api/v1/health/live and
http://localhost:8000/api/v1/health/ready; OpenAPI docs are at
http://localhost:8000/docs. Published ports bind only to loopback. The Compose
credentials are for local development; this setup is not a public deployment.

Alternatively, keep only data services in Docker and run these in separate shells:

```sh
uv run --frozen uvicorn services.api.app.main:create_app --factory --reload
npm --prefix apps/web run dev
```

Run `make migrate` before starting the API outside Compose. Compose runs its
migration service before starting the API.

Defaults match the local data services. Copy `.env.example` to `.env` only when
overriding configuration. API settings use the `CHESS_` prefix and reject invalid
URLs/origins and unsafe production defaults. The frontend proxies `/api` to the
local API; no backend secrets enter its bundle.

## Public game lookup

If `.env` does not exist, create it from the template:

```sh
cp .env.example .env
```

In **`.env`**, uncomment `CHESS_PUBAPI_USER_AGENT` and replace the example contact
with your real operator email or project contact URL. Keep `ChessTutor/0.1` as
the application name and version, then run `make up` to load the setting.
Editing `.env.example` alone does not configure the application. The `.env` file
is ignored by Git; keep personal contact details and credentials there.

The template setting is commented out so a fake contact is never sent upstream.
Without this setting the page explains that public lookup is not configured.
Health checks and fixture tests still work. A host-run API also reads `.env`;
Compose forwards this setting to its API.

Enter a public Chess.com username. The newest archive month opens by default;
choose another month or filter by player color, exact opponent username, and time
class. Filters apply only to that month. Open a game to validate and persist its
main line and replay it immediately. Click either player's SAN or use
first/previous/next/last controls. Focus the replay area for Left/Right arrows,
Home, and End; these keys do not intercept typing in input fields. Flip changes
orientation without changing the selected ply; player names and piece-color
labels swap with their sides. Desktop shows recorded moves and analysis panels
beside the board; smaller screens stack them below. The board caps at 640 CSS px
and shrinks to fit shorter desktop windows. Expand “Text position and FEN”
for occupied squares and the exact imported position. The game remains read-only;
engine analysis and coaching are not available yet. Source links open Chess.com;
no password or provider key is used.

Limits: 300 plies, 1 MiB UTF-8 PGN, 50 MiB monthly JSON, and 1 MiB archive index.
Downloads request uncompressed responses and reject unexpected content encoding
before reading the body. Stale cached data is explicitly labeled; source cache
entries are retained up to seven days, subject to provider directives. Cache
freshness is separate from the game's end time. All redirects are rejected.

## Database migration and recovery

`make migrate` applies Alembic revision `0001`. It creates pending provider records
and canonical game versions; unchanged PGN imports reuse a version. Row locks
serialize imports, and an import rejects a provider update that raced validation.
PGN text/hash, metadata, starting FEN, SAN/UCI, and every resulting position are
stored. Comments remain data and are excluded from the position sequence.

Back up the database before rollback, for example using your PostgreSQL backup
process. Stop API writers, then run `uv run --frozen alembic downgrade base` only
when intentionally removing the Sprint 1 tables and their imported games.
Restore a backup to recover those games, or rerun `make migrate` and discover and
import them again from public archives. The integration gate verifies upgrade,
rollback, and reapply in a disposable database; it never rolls back your app data.
Automated retention/purge and broader backup/restore proof remain Sprint 7 work.

## Verification

| Command | Checks |
| --- | --- |
| `make migrate` | Apply versioned PostgreSQL schema |
| `make contracts` | Export FastAPI OpenAPI and regenerate TypeScript types |
| `make contracts-check` | Regenerate contracts and reject unstaged drift |
| `make check` | Ruff, formatting, mypy, TypeScript, ESLint, function-length limits |
| `make test-unit` | Deterministic Python and TypeScript tests |
| `make test-integration` | Real PostgreSQL/Redis readiness |
| `make test-e2e` | Fixture-backed browser shell at five viewport sizes |
| `make build` | Python source/wheel and frontend production bundle |
| `make verify` | All the above, stopping at the first failure |

Browser tests use port 5174 so they can run alongside the app on port 5173.

The GitHub Actions workflow defines the same gate plus Compose build/startup.
Local success does not mean hosted CI has run. See sprint evidence for actual
results. A failed sprint blocks dependent implementation.

Stop the local stack with `make down`; volumes are retained. Deleting volumes
with `docker compose down --volumes` removes local data and should be deliberate.

## Distribution

Application source: GPL-3.0-or-later; see [LICENSE](LICENSE) and
[dependency notices](THIRD_PARTY_NOTICES.md). Stockfish artifact checksums and
source provenance are in [the engine manifest](engines/stockfish.json). Engine
binaries, models, archives, secrets, and runtime data stay outside Git.

This project is not affiliated with Chess.com. Its analysis and move-label rules
are independent. Optional provider accuracy values are not used as its own score.
