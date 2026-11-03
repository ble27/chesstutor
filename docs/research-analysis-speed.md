# Faster full-game analysis research

Researched 2026-11-03. Research only: no runtime or preset changes implemented.
The PRD remains the product authority; recommendations below would require a
reviewed analysis-policy change. No Chess.com timing/quality equivalence has
been demonstrated.

## What explains the difference

Our current Deep mode runs two sequential searches per ply: an unrestricted
750 ms MultiPV-3 search and a 750 ms search restricted to the played move.
For 80 plies that is 120 seconds of nominal search time, before startup,
persistence, scheduling and polling. This comes directly from
[our preset](../services/core/analysis/values.py) and
[runner](../services/core/analysis/runner.py). Faster CPUs can search more nodes
within those fixed intervals; they do not remove the configured time budget.
Compose also uses a Linux x86-64 worker on ARM Macs, whereas a pinned native
macOS ARM64 executable already exists. Native execution should be measured
separately from changing the analysis policy.

Chess.com publicly explained in July 2023 that its Game Review architecture
changed to standardized per-move **node counts**, reporting a full review in
seconds for Fast and a somewhat longer Standard review. That is evidence for a
node-budgeted architecture, not a published guarantee that every Deep review of
every game completes in seconds. The exact current node budgets, hardware,
parallelism and all review heuristics are not disclosed by that announcement.
[Chess.com engineering announcement](https://www.chess.com/news/view/stockfish-16-on-chesscom).

Current support distinguishes server-side Game Review/Cloud Analysis from
Self-Analysis running on the user's device. It also says Deep/Maximum are
stronger Game Review settings. Therefore a fast whole-game report and continuing
analysis of a selected position are different products to compare.
[Chess.com analysis-depth help](https://support.chess.com/en/articles/8708936-what-is-analysis-depth-what-does-it-mean).
The selected-position Cloud Analysis feature may itself run for minutes and is
enabled per move. No official source examined provides a general seconds-level
Deep/Maximum service-level guarantee.
[Chess.com Cloud Analysis help](https://support.chess.com/en/articles/8646880-what-is-cloud-analysis-and-how-do-i-use-it).

## Recommended approach: native Stockfish with staged work

Keep Stockfish and replace the uniform full-game workload with explicit stages:

1. Return a fast full-game screening pass with a bounded node budget and MultiPV
   1. Prioritize the selected move and report progressive coverage.
2. Preserve a same-root best/played comparison: if the played move appears as the
   best searched line, reuse that evidence; otherwise search the played root
   move explicitly. Do not silently compare unrelated adjacent-position scores.
3. Spend additional verification nodes on unstable results, critical positions,
   candidate tactical badges and moves the user selects. Show provisional status
   until required evidence exists; background completion must not look final.
4. Cache only compatible evidence, keyed by full game/history and exact engine,
   network/options, budget tier and policy versions. A FEN-only cache cannot
   recover repetition history. Existing whole-game cache hits already avoid work.
5. Start with native hardware. A bounded pool may divide positions of one game
   across cores, reconstructing full history for each root. More workers currently
   increase concurrent games, not automatically the speed of one sequential job.

This is our proposed design, not a claim about Chess.com's private implementation.
Stockfish documents node and time search limits, Threads, and MultiPV; its docs
recommend MultiPV 1 for best performance. Node budgets make faster hardware reduce
elapsed search time for equivalent configured work, but node counts do not
perfectly establish equivalent analysis strength across engine versions or roots.
[Stockfish UCI controls](https://official-stockfish.github.io/docs/stockfish-wiki/UCI-Protocol-and-Stockfish-Commands.html).

Use a measured target such as an initial 80-ply review within 5–10 seconds on a
specified native reference machine, then deeper selected-move results. **That is
an experiment target, not a measured capability or promised Chess.com parity.**
If exhaustive current 750+750 ms evidence for every ply must remain unchanged,
matching seconds-level wall time needs substantial parallel hardware and remains
bounded by contention, overhead and cost. A faster engine alone cannot fix this.

## Alternative delivery options

| Option | Benefit | Limitation / fit |
| --- | --- | --- |
| Native server Stockfish + adaptive node budget | Reuses our durable jobs and validated evidence; strongest first experiment | Requires policy/version changes and quality calibration, not just renaming Deep |
| Browser WASM Stockfish in a Web Worker | Removes server queue dependency; immediate selected-position exploration | Device/battery/thermal variation, downloads and weaker lite model; not guaranteed faster cold full-game review |
| Native multi-process server pool | Reduces one-game elapsed time by parallel positions when cores are available | Explicit per-job scheduling, resource/queue fairness and cancellation changes; no free CPU savings |
| Cached external evaluations | Fast for already-known positions | Misses, incompatible provenance/history, API limits and missing played-move evidence prevent replacing core analysis |
| External paid compute | Can supply dedicated native CPU capacity | Requires a documented provider, budget and tested latency/quality; no provider SLA establishing Chess.com equivalence was verified |

Stockfish.js is written for Chess.com's in-browser engine and is available as
full/lite and single/multithreaded variants. Its current README lists full
engines around 94 MB versus lite around 1.6–1.7 MB, states that lite is weaker,
and requires cross-origin isolation for multithreading. Single-threaded versions
avoid those headers. A browser option is viable, but shipping the same WASM family
does not reproduce server-side Game Review's workload or latency. Pin exact
artifacts and preserve GPL notices/source provenance before adoption.
[Stockfish.js maintained source and build matrix](https://github.com/nmrugg/stockfish.js/).

Lichess fishnet is a useful open-source reference: its protocol carries analysis
node budgets and a timeout per ply, and its current client sends node-limited
search commands and reuses an engine across position chunks. Its distributed
worker model is an architecture to learn from, not a free arbitrary-analysis
backend promised to third-party applications.
[Fishnet protocol](https://github.com/lichess-org/fishnet/blob/main/doc/protocol.md),
[Fishnet engine implementation](https://github.com/lichess-org/fishnet/blob/main/src/stockfish.rs).
The project uses CPU-oriented Stockfish and explicitly says it does not use GPUs;
GPU instances are therefore not a drop-in acceleration for our current engine.
[Fishnet README](https://github.com/lichess-org/fishnet/blob/main/README.md).
Fishnet and its included engines retain GPL licensing requirements.
[Fishnet licensing](https://github.com/lichess-org/fishnet/blob/main/COPYING.txt).

Lichess's cloud-evaluation API retrieves existing cached positions, returns 404
for misses, and explicitly requests occasional lookups rather than mass access.
It points bulk users to database exports. It is not an endpoint that computes
a fresh full game to our required evidence policy.
[Lichess cloud-evaluation specification](https://github.com/lichess-org/api/blob/master/doc/specs/tags/analysis/api-cloud-eval.yaml).
API guidance calls for one request at a time and a full-minute pause after 429;
do not fan out all plies against it to chase latency.
[Lichess API guidance](https://lichess.org/page/api-tips).
The evaluation export is CC0, but its schema has varying depth/nodes and omits
full repetition history and our raw same-root WDL/played-move evidence. It could
seed a separately labeled cache after validation, not silently qualify as current
Deep evidence.
[Lichess evaluation database/schema](https://database.lichess.org/#evals).

Hosted alternatives examined include Chessify (cloud engines and desktop GUI
plugin) and Chess-API.com (HTTP/WebSocket position analysis with restricted
search-move support). Neither examined page establishes a whole-game latency
SLA or documents our complete raw WDL, versioned provenance and history contract.
Chess-API.com's documented `winChance` is a centipawn-derived formula, not raw
engine WDL, so it cannot replace our WDL evidence directly. These are options to
evaluate for a paid/hosted strategy, not validated drop-in recommendations; no
game data was submitted and no paid service was called.
[Chessify](https://chessify.me/), [Chess-API documentation](https://chess-api.com/).

## Prototype and decision criteria

Local experiment (not a production benchmark), on a MacBookAir10,1 with Apple M1,
8 GiB RAM and 8 logical CPUs (engine Threads 1): the pinned native
Stockfish 17.1 ARM executable analyzed the first 80 plies of the synthetic legal
line in `tests/unit/long_game_fixture.py`, with one warm engine, Threads 1,
Hash 128, WDL and full history. Each root used MultiPV 1, a node budget plus a
200 ms wall cap, and a restricted played-move search unless best and played
moves matched.

| Per-search node budget | Elapsed search loop | Searches | Total nodes | Legal PV + WDL pairs |
| --- | --- | --- | --- | --- |
| 10,000 | 1.183 s | 157 | 1,564,561 | 80/80 |
| 30,000 | 3.246 s | 155 | 4,644,794 | 80/80 |

This direct-protocol/normalization experiment excludes startup, database, API,
queue, classification and rendering. The synthetic line includes simplified
positions and does not demonstrate equivalent tactical quality, representative
latency or an SLA. A one-position 750 ms comparison also searched about 3.3 times
as many nodes natively as under the current Docker x86 emulation; that single
comparison does not establish a general speed multiplier. Neither result means
that faster hardware removes our existing fixed-time search budget.

A read-only follow-up used the first 80 plies of one existing imported game,
reconstructed from its canonical initial FEN and UCI history. With the same warm
native setup, 10,000 nodes/search took 1.064 s (136 searches, 1,349,572 total
nodes); 30,000 took 2.607 s (135 searches, 3,959,025 nodes). Both returned 80 legal
best/played PV pairs with WDL. This single game also includes easy/decisive
positions; no stronger-reference quality comparison was performed. These are
screening-work measurements, not current Deep-quality results. No database/job
records were modified.

Commands used: native ephemeral scripts through `uv run --frozen python`, and
the same single-position script through `docker compose exec -T worker
.venv/bin/python -`. Local experiment scripts/logs are under
`/tmp/chesstutor-node-budget-research*`,
`/tmp/chesstutor-real-game-node-research*` and
`/tmp/chesstutor-analysis-research-bench.py`. No application source was changed.

Before changing the product contract, benchmark at least 30 diverse games on a
named machine, including 80-ply and long games, repetition/draw histories, mates,
quiet positions and tactical swings. Compare current Deep with native execution,
node-budgeted screening, selective verification and bounded parallel batches.
Record cold/warm loading, queue delay, time to first selected move, time to initial
whole-game coverage, time to final verified evidence, CPU/RAM and cancellation.

Validate candidate moves/PVs legally and compare against a materially stronger
reference pass using tolerances and human-reviewed tactical cases. Track false
confident tactical claims and uncertain coverage, not only depth or throughput.
Keep preview and verified evidence distinct, and revise PRD budgets/versioning
only after measured quality and latency support the choice. Browser results
cannot automatically receive server-verified badges. Documentation links and
whitespace were checked; no application regression gate was run for this
research-only change.
