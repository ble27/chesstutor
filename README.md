# Chess Tutor

Free, independent review of completed public Chess.com games. The product plan
combines Stockfish analysis, replay for both players, and chess-only guidance.

Sprint 1 adds public username/month lookup, monthly filtering and pagination,
and validated, versioned game import to the Sprint 0 foundation. S2 adds exact
both-player replay, accepted by the user. S3 adds bounded Stockfish jobs and
persisted evidence; see its gate status below. S4 classification is in progress;
coaching remains S5.

- [PRD and sequential sprint gates](docs/PRD.md)
- [Sprint 0 evidence](docs/sprints/S0.md)
- [Sprint 1 evidence](docs/sprints/S1.md)
- [Sprint 2 implementation and acceptance status](docs/sprints/S2.md)
- [Sprint 3 implementation and gate evidence](docs/sprints/S3.md)
- [Integration research](docs/research.md)
- [Contributor conventions](AGENTS.md)

## Current status

This is a local development project, not a production release. Current S4 work
adds independent move labels, per-player counts, and coverage-aware summaries.
Quick labels are provisional. Badge verification searches, practice themes,
coaching, and remaining accessibility and production gates are incomplete.
Previously committed S5–S7 specifications intentionally fail until implemented;
`make verify` therefore does not currently pass. See [S4 evidence](docs/sprints/S4.md)
and the [repository security review](docs/security-review.md) for checks and limits.

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
make engine-install
uv run --frozen python -m services.worker.main
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
choose Quick or Deep review in the engine panel. Coaching remains unavailable.
Source links open Chess.com;
no password or provider key is used.

## Engine analysis

Run `make up` after pulling S3 to rebuild the stack. Compose starts two workers
with verified Stockfish 17.1, one thread and 128 MiB hash each. Its pinned worker
image is Linux x86-64; Docker Desktop on ARM uses emulation. Native installation
supports macOS ARM64 and Linux x86-64 through `make engine-install`. Unsupported
platforms fail explicitly. Workers and jobs are partitioned by executable checksum.

Quick searches each pre-move position for 100 ms with two candidates, then the
played move for 100 ms at that same root; Deep uses 750 ms and three candidates,
then 750 ms for the played move. Job deadlines are 90/540 seconds. Progress is
persisted per ply; cancellation, failure and timeouts retain partial evidence.
Retry creates a new job subject to quotas. A crashed attempt can recover once
using its original deadline. Polling does not reset replay selection.

Select a recorded move to see its pre-move alternatives and White-perspective
evaluation. Mate distance is separate from centipawns. WDL and PV evidence is
stored; missing or unstable comparisons remain uncertain. Compatible v1 server
results also show independent move labels and
coverage-aware summaries. Legacy cached results retain their original provenance
and do not receive new labels. Coaching remains unavailable. Completed cached Deep
results offered for Quick retain their Deep label and consume no engine quota.

A signed anonymous HttpOnly session owns active jobs and cancellation; retain
the browser cookie while a job runs. Analysis submission and cancellation require
the configured frontend Origin. Limits are one active job/session, five Quick and two Deep jobs per
rolling hour/session, 20 jobs/hour/IP by default, 50 queued and two running.
Shared-network limits show retry feedback. General readiness checks PostgreSQL
and Redis; submissions separately require a verified, live engine worker.
For production set a private `CHESS_SESSION_SECRET` of at least 32 characters,
stable across API restarts, plus the existing production settings. Configure
`CHESS_ANALYSIS_IP_JOBS_PER_HOUR` deliberately for shared networks.
API clients first receive `409 session_required` and a signed cookie if no valid
session exists; that response allocates no work. Resend the same submission with
the cookie. The browser does this once automatically; blocked cookies show an
error. This keeps the first accepted job retryable after a lost response.

Limits: 300 plies, 1 MiB UTF-8 PGN, 50 MiB monthly JSON, and 1 MiB archive index.
Downloads request uncompressed responses and reject unexpected content encoding
before reading the body. Stale cached data is explicitly labeled; source cache
entries are retained up to seven days, subject to provider directives. Cache
freshness is separate from the game's end time. All redirects are rejected.

## Browser engine experiment

This branch includes a **browser Stockfish experiment**, separate from the S3
server workflow. With dependencies installed and local PostgreSQL/Redis running:

```sh
make browser-experiment
```

Open http://127.0.0.1:5175/?engine=browser, find/open a game and select
**Browser Quick review**. The full pinned Stockfish 17.1 engine runs in a Web
Worker on your device. The first full-engine download is approximately 70 MiB;
later starts use browser caching. Use **Deepen selected move** for more work on
one position. Cancellation retains locally cached positions for resume. A
lightweight API on port 8001 validates legal variations against imported history;
this experiment still needs that API and is not an offline application.

Results remain provisional personal evidence; they do not populate the trusted
server analysis cache or receive server-verified badges. Screening uses smaller
node budgets than S3 Deep. Closing the tab stops computation. A two-thread cap
is available with browser isolation support; otherwise use the single-thread
fallback. Hardware/browser quality and performance gates remain open.

The original Docker stack on http://127.0.0.1:5173 is left intact for comparison.
The experiment's `?engine=server` view requires a matching native worker; use the
original stack to compare its existing Linux workers. See the
[experiment evidence](docs/sprints/browser-experiment.md) for measured results,
the reproduced Quick defect and limitations. This is not an S4 implementation
or a production rollout.

## Database migration and recovery

`make migrate` applies Alembic revision `0002`. Revision `0001` creates pending provider records
and canonical game versions; unchanged PGN imports reuse a version. Row locks
serialize imports, and an import rejects a provider update that raced validation.
PGN text/hash, metadata, starting FEN, SAN/UCI, and every resulting position are
stored. Comments remain data and are excluded from the position sequence.
Revision `0002` adds analysis jobs, dispatch/recovery state and per-ply evidence.
After stopping API and workers, `uv run --frozen alembic downgrade 0001` removes
only analysis data; imported games remain. Reapply with `make migrate`.

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
| `make engine-install` | Install/verify the pinned engine with license and provenance |
| `make test-integration` | Disposable PostgreSQL, real Redis, pinned engine, lifecycle/recovery |
| `make test-e2e` | Fixture-backed browser shell at five viewport sizes |
| `make build` | Python source/wheel and frontend production bundle |
| `make verify` | All the above, stopping at the first failure |

Browser tests use port 5174 so they can run alongside the app on port 5173.

The GitHub Actions workflow defines the same gate plus Compose build/startup.
Local success does not mean hosted CI has run. See sprint evidence for actual
results. A failed sprint blocks dependent implementation.

Stop the local stack with `make down`; volumes are retained. Deleting volumes
with `docker compose down --volumes` removes local data and should be deliberate.

## API and security boundaries

All application endpoints use `/api/v1`. The authoritative contract is
[OpenAPI](contracts/openapi.json); FastAPI serves interactive docs at `/docs`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/v1/health/live`, `/api/v1/health/ready` | Process and dependency health |
| GET | `/api/v1/players/{username}/archives` | Public archive months |
| GET | `/api/v1/players/{username}/games` | Monthly games; requires `year` and `month` |
| GET | `/api/v1/games/{game_id}` | Validate/import and retrieve a discovered public game |
| POST | `/api/v1/analyses` | Start bounded Quick/Deep analysis |
| GET | `/api/v1/analyses/{analysis_id}` | Read analysis evidence and progress |
| POST | `/api/v1/analyses/{analysis_id}/cancel` | Owner-only cancellation |
| POST | `/api/v1/games/{game_id}/browser-evidence` | Experimental legal-line validation; scores remain untrusted |

Analysis submission/cancellation and browser-evidence POSTs require an exact
configured Origin. Analysis submission also requires
a signed session-cookie roundtrip; cancellation checks ownership. Public game
records are public data. Inputs are validated at API, provider, and chess-domain
boundaries; external text is rendered through React text escaping. The server
constructs allowlisted Chess.com URLs and rejects redirects.

Keep credentials in ignored `.env` files or server environment variables. Never
put secrets in `VITE_*` variables, source, fixtures, URLs, or Git remotes. The
checked-in `.env.example` contains local development placeholders. Git ignore
rules do not remove secrets already committed; rotate exposed credentials and
handle history remediation separately if an exposure is found. Production
proxy/security headers, abuse testing, retention, and release checks remain S7
gates. See [the audit record](docs/security-review.md) for the actual review scope.

## Distribution

Application source: GPL-3.0-or-later; see [LICENSE](LICENSE) and
[dependency notices](THIRD_PARTY_NOTICES.md). Stockfish artifact checksums and
source provenance are in [the engine manifest](engines/stockfish.json). Engine
binaries, models, archives, secrets, and runtime data stay outside Git.

This project is not affiliated with Chess.com. Its analysis and move-label rules
are independent. Optional provider accuracy values are not used as its own score.
