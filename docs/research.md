# Integration research

Verified against primary sources on 2026-11-02. These are integration facts and
explicit design recommendations, not claims that the application is implemented.

## Chess.com public data

The PubAPI is a read-only API for public information; it does not require a
player's login. Use these paths below `https://api.chess.com/pub`:

| Purpose | GET path |
| --- | --- |
| Public profile | `/player/{username}` |
| Available months | `/player/{username}/games/archives` |
| Finished games in one month | `/player/{username}/games/{YYYY}/{MM}` |
| Monthly multi-game PGN | `/player/{username}/games/{YYYY}/{MM}/pgn` |

Monthly records include PGN, participants, results, timestamps and variant rules.
Optional `accuracies` may exist when previously calculated. The documented
interface has no per-move Game Review labels or coach-explanation endpoint;
independent analysis is therefore necessary. This is an inference from the
published endpoint inventory, not a claim that accuracy is never exposed.

Parallel requests can receive 429; the documentation favors serial requests and
a recognizable User-Agent with contact information. Conditional requests use
ETag/Last-Modified and 304. Refresh statements conflict: 12 hours in the overview,
24 hours in the caching section. Honor response cache headers and show freshness
without promising immediate updates. Chess.com asks integrators to respect its
distinctive palettes, pieces, sounds and classification glyphs.
[Source: Chess.com PubAPI documentation](https://www.chess.com/news/view/published-data-api).

## Python chess parsing and engine interface

`python-chess` supplies legal-move validation and PGN parsing. Its installer name
is `chess`; Python imports use `chess`. The library is GPL-3.0-or-later.
[Source: python-chess project documentation](https://python-chess.readthedocs.io/en/stable/).

PGN parsing is forgiving and records errors in `Game.errors`; a returned game
alone does not establish valid input. Replay the main line from `game.board()`,
which respects a setup FEN, and reject parser errors or illegal positions before
analysis. Maintain history for repetition-sensitive evaluation.
[Source: PGN parsing documentation](https://python-chess.readthedocs.io/en/stable/pgn.html).

The UCI adapter supports asynchronous analysis, search limits, multiple principal
variations and restricting root moves. Results carry centipawn or mate scores,
POV, principal variation, depth and nodes; WDL can also be supplied. Convert
scores to an explicit color before comparison. WDL expectation values a win as
1, draw as 0.5, loss as 0. Preserve mate scores as a separate type. The docs warn
that engines are executable processes and invalid input can be unsafe.

Recommendation: retain engine-provided WDL and its version when available;
do not silently assume the library's default `wdl(model="sf")` tracks the current
Stockfish release. The documentation currently describes older model versions.
Any fallback conversion needs an explicit version and calibration tests.
[Source: python-chess engine documentation](https://python-chess.readthedocs.io/en/stable/engine.html).

## Stockfish controls and distribution

Stockfish supports `go` limits for time, depth and nodes. Combining limits stops
at the first limit reached; a requested depth is not a guarantee that depth will
be attained. `Threads` and `Hash` constrain search resources; `MultiPV` returns
alternative lines and increases work. `UCI_ShowWDL` reports an engine self-play
outcome model, not a personalized human win probability. Providing move history
helps repetition detection. `stop` interrupts searching. UCI initialization
reports the actual supported options, which may vary by binary.

Recommendation: distinguish quick and deep presets through bounded budgets;
record achieved depth, nodes, limits, engine version and configuration. Apply
external deadlines and process cleanup as well as UCI search limits.
[Source: Stockfish UCI documentation](https://official-stockfish.github.io/docs/stockfish-wiki/UCI-Protocol-and-Stockfish-Commands.html).

Stockfish does not generate explanatory move commentary itself. A separate
coaching layer is required. It is GPL v3; its integration documentation requires
the license and corresponding source, or a source pointer for the exact binary,
when distributing it, and publication of distributed modifications under GPL v3.
Choose a compatible project distribution policy before packaging binaries; keep
dependency notices and source provenance.
[Source: Stockfish integration documentation](https://official-stockfish.github.io/docs/stockfish-wiki/Developers.html).

The official download page currently advertises Stockfish 19. Pin a verified
release, platform artifact and checksum during implementation; do not use an
unversioned download in CI or make the PRD depend on a moving latest release.
[Source: official downloads](https://stockfishchess.org/download/).

## Web stack fit

FastAPI's documentation recommends considering separate queue-based workers for
heavy computation; its request-process background tasks suit smaller work.
Recommendation: keep HTTP handlers short, submit durable analysis jobs, and run
Stockfish in bounded worker processes with job cancellation and recovery.
[Source: FastAPI background tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/).

PostgreSQL documents `FOR UPDATE SKIP LOCKED` for avoiding contention between
consumers of queue-like tables. This is a considered alternative to the selected
Redis/RQ queue. Such a design needs short claim transactions,
then commit before engine work; application-level leases, heartbeats and fencing
tokens must handle worker crashes and prevent expired workers overwriting newer
results. Row locking alone is not a complete durable-job system.
[Source: PostgreSQL SELECT locking](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE).

RQ supports Redis-backed jobs with execution timeouts and retention controls;
each worker handles one job at a time. The PRD selects separate RQ workers to
reuse a queue library rather than build a database queue. Persist application
review state separately and handle dispatch/recovery consistency explicitly.
[Source: RQ queues](https://python-rq.org/docs/),
[source: RQ workers](https://python-rq.org/docs/workers/).

Vite offers a frontend development server and production build pipeline, including
React/TypeScript templates. TypeScript's strict mode enables a family of stronger
type checks. Recommendation: a React/TypeScript client with strict types and a
typed FastAPI client is sufficient; a second business-logic API server is not
required solely to handle browser requests.
[Source: Vite guide](https://vite.dev/guide/),
[source: TypeScript strict configuration](https://www.typescriptlang.org/tsconfig/strict.html).

React documents typed components/hooks and `.tsx` files for JSX.
`react-chessboard` is MIT-licensed and supports custom pieces, styling, dimensions,
responsive display and TypeScript. Recommendation: wrap it behind a small board
component; verify keyboard and screen-reader behavior in the actual interface
instead of treating the library's accessibility claim as acceptance evidence.
[Source: React TypeScript guide](https://react.dev/learn/typescript),
[source: react-chessboard repository](https://github.com/Clariity/react-chessboard).

## Optional local language model

`llama-server` supports local GGUF inference, HTTP chat completions at
`/v1/chat/completions`, and schema-constrained JSON responses. It defaults to
loopback port 8080; authentication keys can be configured. No hosted provider is
required to call its local HTTP API.

Recommendation: keep the service private behind the Python backend; allow only
intent enums and verified evidence identifiers in its output schema. Validate
those values again in application code, then render reviewed chess templates.
Do not pass raw model prose to users. Set request/token limits, pin the server
build and model artifact, verify that model's license separately, and preserve
template-based coaching when the model is absent or fails.
[Source: llama.cpp server documentation](https://github.com/ggml-org/llama.cpp/tree/master/tools/server).

## Decisions that sources cannot settle

- Move labels, thresholds, confidence rules and brilliant-move heuristics are
  product definitions requiring fixtures and calibration; they are not supplied
  by Stockfish or guaranteed to match Chess.com.
- Analysis latency depends on hardware, game length, budgets and concurrency;
  benchmark deployment hardware before making public timing promises.
- Hosted computation and language models have operating costs even when the
  product is free to players. Set quotas and provide useful engine-derived
  coaching when optional language-model service is unavailable.
- A chess-only assistant needs enforced request routing, output validation and
  adversarial evaluation. A system prompt alone cannot establish the restriction.
