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

## Unified review, dashboard and local engine implementation

The S6 sprint-start baseline remains `dd23c1c14d984f581a884444bf7c883d8414f4a1`;
the upgrade boundary at the top of this file does not replace it. Whole-sprint
review covers both the previously committed S6 work and this approved expansion.

- Module 2: the main workspace owns an original NPC avatar, automatic notes for
  each analyzed ply, explanation level, text alternatives and optional local English
  speech. There is no standalone guidance tab or chat in the application. The old
  API and compatibility component tests remain; the app no longer imports that UI.
  Speech cancels during navigation/previews/unmount. Coach state stays mounted but
  suspended in variations/free analysis, preserving the user's arrow/voice choices.
- Module 3: a pinned SVG graph uses matched engine values, separate White/Black
  areas, non-overshooting interpolation, gaps, classification markers and a range
  control as the keyboard equivalent of pointer selection. Desktop keeps board,
  coach, graph and navigation visible together. Narrow screens and heights below
  750px reflow; inner move lists retain their own scroll, and short-screen navigation
  stays sticky. Primary coach text leads; options/alternatives are disclosures.
- Module 4: Analyze imports and automatically requests Standard once, including
  under React Strict Mode. Settings offers bounded Standard/Thorough server presets
  plus local depth 1–40 (18 default), 1–4 supported threads and 128MiB hash. Local
  UCI searches use a 9.5-second search budget inside the ten-second advertised cap,
  separate startup/watchdog bounds, and report achieved/requested depth honestly.
  Pinned server Stockfish 19 and browser Stockfish.js 17.1 provenance is unchanged.
  No WebGPU capability is advertised.
- Module 5: free analysis starts at the displayed recorded position, preserving its
  complete history. Backend validation precedes board changes. Drag/drop and legal-
  move selection support promotions; undo/redo and bounded saved branches are local
  state, capped at 20 saved paths of at most 100 plies. Return preserves recorded
  selection/orientation. One local worker at a time streams legally validated PVs
  and explicit client-unverified White scores; requests/searches abort and stale
  generations cannot publish. Arrows are optional. Neither local refinement nor
  sandbox evidence replaces server coaching, classifications or accuracy.

The shared position owner separates recorded selection, displayed source preview,
stored variation and sandbox state. Review found that a coaching pre-move preview
could otherwise leave an after-move score/graph visible; these now follow the
actual displayed root. Graph selection exits source-arrow preview and updates its
checkbox consistently. Sandbox/refinement capture that displayed root, avoiding
an initial wrong-board flash. Recorded graph data is hidden during sandbox play.

### Regression and review evidence

Coach and graph cases ran red before implementation. Sandbox domain tests ran red
before its implementation; HTTP, speech, custom-depth, auto-start and branch-hook
cases were added after the relevant initial implementation. This is a test-first
workflow limitation, not a claim that every added test had an initial red run.
The coach-suspension regression did reproduce the failure before its fix.

Frontend unit: **252 passed**. Backend unit via `make verify`: **498 passed / 43
inherited S7 failures**. Contracts and all static checks pass, including strict TS,
Ruff/mypy and physical function lengths. No exceptions or new dependency/toolchain
were introduced. Tests cover formula/coverage, legal special moves/history,
session/origin/size/version/PV checks, strict-mode auto-start, worker time/depth
commands and cleanup, voice opt-in/cancellation, stale sandbox responses, preview
suspension/preferences, graph/root matching and sandbox entry from a source preview.

Existing browser scenarios were updated for Analyze, settings and continuous
coaching. Retired chat UI cases now test voice/text and automatic-note retry;
backend refusal/adversarial cases remain unchanged. Engine request-count assertions
exclude the newly required lesson reads but still assert exactly one engine request.
The hidden library-field keyboard case now uses the visible depth input. No test
was skipped/xfailed and no timeout was increased on existing cases.

Browser review exposed real layout defects: graph/control overlap, inaccessible
short-screen sticky navigation, and a partially clipped selected move. Fixed by
reserving usable scroll regions, allowing short-screen reflow, and centering the
whole move button with resize observation. The short-screen move-list test explicitly
reveals the move region before checking internal navigation; all original geometry
and visibility assertions remain. Desktop viewport cases explicitly check board,
coach, graph and toolbar visibility together at 1440×900 and 1024×768.

One concurrent unit/browser attempt produced seven five-second unit timeouts;
unchanged quiet unit reruns passed. Earlier browser attempts hit ENOSPC during trace
writing, and Docker's VM log also records a disk-full crash. Temporary browser
artifacts were subsequently released and free space recovered; no personal files,
Docker volumes, engine images or VM data were deleted. These failed attempts are
not represented as successful gates.

Equivalent `/diff` and `/review` used the fixed S6 baseline, upgrade baseline, all
tracked/new files and the unrelated untracked inventory against AGENTS.md, PRD and
the approved plan. Corrected root mismatches, preview-state resets, selected-button
clipping and graph/control overlap. No remaining actionable code finding at this
checkpoint. Final command results and implementation commit IDs follow below.

### Remaining acceptance and environment limits

`make test-integration` currently fails at migration: PostgreSQL 127.0.0.1:5433
refuses connections. No real integration case ran in this upgrade session. Docker
Desktop cannot start after its recorded disk-full crash; ordinary launch and a
bounded, non-destructive restart failed. Native dialog inspection also timed out.
No factory reset, volume purge or settings change was attempted. The prior S6
34-case integration pass is historical evidence, not a result for this tree.

The running Compose application could not be refreshed. After Docker recovery,
run `make up`, `make test-integration` and the applicable gates again. Preserve the
previous five-second emulated UCI cold-start observation for S7; it is not fixed.
Manual screen-reader/native zoom/physical touch and voice-quality acceptance remain
open, including S5 carryover. Emulated reflow and automated contrast do not close
those gates. S6/release are not certified complete and S7 remains unstarted.

### Final upgrade verification

Final source verification on 2026-11-18:

| Command/check | Observed result |
| --- | --- |
| `make check` | Passed: Ruff, mypy, strict TypeScript, ESLint, Prettier and function lengths |
| Contract generation/drift through `make verify` | Passed |
| Frontend unit suite | 252 passed |
| `make verify` Python unit stage | 498 passed; 43 inherited, unimplemented S7 failures; command fails |
| `make test-e2e` | 69 passed, including real WASM sandbox and desktop visibility/reflow cases |
| `make build` | Python sdist/wheel and TypeScript/Vite production bundle passed |
| `make test-integration` | Blocked at migration by unavailable PostgreSQL; zero cases ran |
| Production bundle retired-chat text scan | Neither “Ask a chess question” nor “Ask the coach” remains |
| Documentation links and `git diff --check` | Passed |

Reviewed final desktop dashboard, source-arrow and narrow-screen captures. The
1024×768 dashboard keeps board, coach, graph and navigation visible together;
shorter and narrow screens intentionally reflow. Some fixture captures exercise
unavailable-note recovery rather than a successful lesson. Automated/browser
capture inspection does not replace the open human acceptance gates.

Slash commands are unavailable in this tool session. Equivalent Git diff and
code review covered the fixed sprint baseline through the complete working tree,
including new files, against AGENTS.md, PRD and this plan. Personal configuration
and pre-existing untracked files were excluded from implementation and staging.
The code review dispositions above remain unchanged after final verification.

Handoff: recover Docker without deleting persisted data, rerun integration and
app startup, complete S5/S6 manual acceptance, and resolve all required gates
before certifying S6 or starting dependent S7 work. No release readiness is claimed.

### Reviewed commit handoff

- Sprint-start baseline: `dd23c1c14d984f581a884444bf7c883d8414f4a1`.
- Upgrade boundary: `d345cf90318c78ad3cc310f2ac19440ece563a40`.
- Board and accuracy: `91b8583e029c333048ef00aebd29d10c2323af5a`.
- Sandbox API and contracts: `86b003d308d07506431667f820b990ccd8413c1c`.
- Final implementation: `b354c33c64b3b5ee7b9ab0fc36d5a8a911c393ed`.

The subsequent `docs(review): record upgrade verification and remaining gates`
commit is the evidence-only handoff, identifiable through Git history. Its changes
only record these IDs; file-link and whitespace checks were repeated. The final
implementation tree is the tree tested above. All remaining untracked paths are
pre-existing personal configuration/product notes, not uncommitted upgrade code.
