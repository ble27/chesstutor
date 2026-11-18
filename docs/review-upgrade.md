# Approved Game Review upgrade — 2026-11-18

Fixed implementation baseline: `d345cf90318c78ad3cc310f2ac19440ece563a40`.
User approved the six-module plan and requested implementation. This is an
approved expansion of S6, not S7 release work. Prior manual gates stay open.

Implement in order 1 → 6 → 2 → 3 → 4 → 5, tests first and coherent commits.
1. Classic licensed pieces, tan/cream board, thin light-green arrows below pieces,
   accessible SVG navigation icons with 44px targets.
6. Backend versioned accuracy from usable unbounded best/played scores, mover POV;
   supplied logistic Win% and exponential accuracy coefficients, no bonus;
   harmonic/volatility-weighted blend, explicit coverage, mate endpoints.
2. Replace standalone guidance/chat with automatic per-ply NPC coach; local browser
   speech opt-in, cancellation and text fallback; preserve template grounding.
3. Viewport desktop dashboard and selectable smooth evaluation graph; accessible
   reflow/scroll exceptions on small, short and zoomed viewports.
4. Analyze imports and automatically starts Standard (existing Quick) once;
   bounded server Standard/Thorough presets in settings; local WASM depth 1–40,
   default 18, 10-second cap, achieved depth, 1–4 supported threads, 128MiB hash.
5. Backend-validated sandbox rooted in recorded history, 100-ply/16KiB bounds;
   one local worker, cancellation/stale-generation isolation, validated live PVs,
   optional arrows, promotion/branches/undo/redo and return to recorded review.

Hybrid engines: server Stockfish 19 stays authoritative for coaching/accuracy;
local pinned WASM 17.1 refinement/sandbox stays client-unverified. No WebGPU claim.
The user chose licensed classic equivalents and an original coach avatar,
responsive layout exceptions, and backend rules rather than offline chess rules.
The new request supersedes older palette, standalone-chat, entry-button and
accuracy requirements in PRD/plan/DESIGN; update their descriptions with delivery.

No proprietary Chess.com assets, CAPS-parity claims, new Book/Skill/Game Rating
metrics, or release certification. Human accessibility evidence remains deferred.
Record commands, outcomes, review findings and commit IDs below. Slash commands
are unavailable; use complete baseline-to-working-tree diff and equivalent review.

## Modules 1 and 6 checkpoint

Implemented explicit GPL-2.0-or-later Merida assets (Armando Hernandez Marroquin),
tan/cream squares, thin #ACC65B suggestions at 0.8 opacity below pieces, narrow
contrasting edge, SVG navigation with original accessible names and 44px controls.
Inspected the browser-rendered fixture screenshot; thin arrows do not cover pieces.

Backend logistic-v1 accuracy derives from persisted usable unbounded score pairs,
with mover POV, separate mate endpoints, harmonic/weighted blend, signed terminal
mate-zero handling and scored coverage. It is recalculated on reads, requires no
migration/engine rerun, and is additive in OpenAPI. Legacy API results without
calibration say unavailable; no frontend fallback to the old generous metric.

Tests: board/navigation cases ran 2 failed before implementation. Accuracy tests
were written first, but the initial run failed on the sandbox UV cache path;
using the repository cache resolved it after implementation. This is a recorded
test-first execution limitation, not a claimed initial behavioral red run.
Five new Python formula/coverage/aggregation tests pass. Frontend suite: 239 pass;
static checks pass; thin-arrow browser case passes. One earlier concurrent frontend
run had a five-second replay timeout; unchanged quiet rerun passed, with no timeout
or assertions weakened. Contract generation passed; make verify initially stops
on the intentional uncommitted contract change (drift checks compare against HEAD).
Run it again after the checkpoint commit. Full integration/browser/build acceptance
is still pending. No sprint completion is claimed.

Equivalent whole-upgrade review covers the fixed baseline, new files and unrelated
untracked inventory. Corrected the arrow overlay's actual 2048-unit viewBox selector,
missing GPL-2 license retrieval, Black-start totals, signed mate zero, missing-window
breaks and runtime accuracy coverage validation. No mandatory length exception.

## Backend free-analysis boundary checkpoint

Added stateless `/api/v1/games/{id}/sandbox` with typed bounded branch and optional
local UCI-line validation. It reconstructs canonical recorded history, validates
all legal moves with Python chess rules, preserves draw history and setup FEN,
and returns legal moves, canonical branch positions and client-unverified lines.
Session/origin checks and a 16KiB body limit apply; branches are capped at 100 plies.
No persistence, migration, server engine allocation or score trust promotion.
Domain tests ran red on the missing module before implementation; HTTP tests were
added after implementation. Domain/HTTP cases cover illegal moves, underpromotion,
castling, en passant, repetition history, session challenge, origin, version, size
and illegal PV rejection. The frontend integration and final gates follow.
