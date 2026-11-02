# Chess Tutor

Free, independent review of completed public Chess.com games. The product plan
combines Stockfish analysis, replay for both players, and chess-only guidance.

Sprint 0 implements the API/frontend foundation and verification tooling. Username
lookup, replay, engine execution, and coaching follow in S1–S5; the current page
is a service-connected shell and does not claim to review games yet.

- [PRD and sequential sprint gates](docs/PRD.md)
- [Sprint 0 evidence](docs/sprints/S0.md)
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

Defaults match the local data services. Copy `.env.example` to `.env` only when
overriding configuration. API settings use the `CHESS_` prefix and reject invalid
URLs/origins and unsafe production defaults. The frontend proxies `/api` to the
local API; no backend secrets enter its bundle.

## Verification

| Command | Checks |
| --- | --- |
| `make contracts` | Export FastAPI OpenAPI and regenerate TypeScript types |
| `make contracts-check` | Regenerate contracts and reject unstaged drift |
| `make check` | Ruff, formatting, mypy, TypeScript, ESLint, function-length limits |
| `make test-unit` | Deterministic Python and TypeScript tests |
| `make test-integration` | Real PostgreSQL/Redis readiness |
| `make test-e2e` | Fixture-backed browser shell at five viewport sizes |
| `make build` | Python source/wheel and frontend production bundle |
| `make verify` | All the above, stopping at the first failure |

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
