# Browser Stockfish experiment

Date: 2026-11-03. Status: verified prototype; production adoption gates remain open.
Branch: `experiment/browser-stockfish`.
Fixed starting commit: `787ce2ee6436569e2643a4d122add5b4a4d4890a`.

The user requested execution of the browser-first recommendation in
[the cross-platform note](../research-cross-platform-analysis.md), on a separate
branch because Quick also fails. The requested filename was not present; this
matching note recommends full-strength WASM with optional native execution.

Question: can full Stockfish WASM provide a working, faster personal-review path
without server engine queues or x86 emulation, while preserving history, legal
variations and honest provisional status?

The original experiment kept main unchanged and preserved the server workflow
for comparison; no S4/S5 classification or coaching work. Browser evidence remains local/untrusted, never
uploaded into the server's verified evidence cache. Prototype branch changes may
revise execution and budget assumptions; no Chess.com-equivalence claim.

Baseline inspection found recent Quick failures at 98/103/101 of 154 plies,
`invalid_evidence`; Deep also failed at 87/154. All current containers reported
healthy. A read-only replay subsequently reproduced the exact engine output;
see the defect evidence below. No user game or job data was changed.

Tests use the previously confirmed public replay/engine-panel and browser journey
seams; existing runner/normalization seams cover the reproduced server defect.
Real WASM acceptance checks are additional experiments, not mock-only evidence.
No new public seam confirmation is required for those existing approved seams.

## Implemented experiment

- Opt-in `?engine=browser` panel; original server panel remains the default.
  `make browser-experiment` serves the branch on 5175 and a lightweight legality
  API on 8001; the original Docker app on 5173 is not rebuilt/replaced.
  The standalone factory disables background analysis reconciliation so this
  additional API cannot reschedule the main application's shared jobs. Default
  application startup still reconciles and closes resources normally;
  red-then-green public lifespan tests cover both cases.
- Full Stockfish.js 17.1.0 pinned by npm SHA-512 and individual JS/WASM SHA-256
  values in `engines/stockfish-browser.json`. Build preparation and the browser
  check exact hashes. Both single and threaded builds are included; no lite
  fallback. Both native and browser UCI report NNUE identities
  `nn-1c0000000000.nnue` and `nn-37f18f62d772.nnue`. Their executable/build hashes
  remain distinct. License content is preserved with normalized repository line
  endings; public assets retain the upstream license file.
- Browser selects two threads only with isolation/SAB and sufficient reported
  hardware concurrency; otherwise one. Users can select the single-thread path.
  COOP/COEP are provided by the development server; downloads report progress and
  use browser HTTP caching. This is local asset delivery, not a WAN benchmark.
- Screening targets 30,000 nodes/search, MultiPV 1, with a 250ms search cap.
  Selected-move refinement targets 300,000 nodes with a 1500ms cap. Time caps can
  end work before node targets: these are not guaranteed equal-node comparisons.
  Best/played searches share full initial FEN and prior UCI history; an identical
  best/played move reuses its searched line. Selected ply is processed first.
- Canonical rules and PV legality remain in Python. A bounded, origin-checked
  browser-evidence route handles at most eight positions / 64 KiB per batch,
  replays history and legally normalizes scores, WDL, SAN and terminal outcomes.
  It explicitly returns `client_unverified`; it never writes analysis/job/cache
  rows. Browser scores are not authenticated just because legality validates.
- Validated raw positions are cached in IndexedDB by exact artifact, options,
  game/version/PGN history, policy and budget. Resume revalidates every position.
  Rejected cached evidence is cleared rather than retrying it indefinitely.
  Blocked cache opening is bounded. Cancellation terminates the worker throughout
  its lifetime, including while storage publication is pending. Game/thread
  changes abort previous work. UI clears old finished status before a new run.

The trusted S3 analysis API/preset workflow remains independent. No classification
or coaching, automatic critical-move verification, offline-only review, or
production deployment is claimed. Backend legality validation is still required.

## Diagnosed Quick defect

A read-only replay using the actual Linux engine reproduced `invalid_evidence`
at ply 102: a PV continued with legal moves after an automatic draw by
insufficient material. Rejecting the entire line discarded the game job.

The regression fixture is Bxc2 producing K+B vs K followed by a king move.
It failed at the original validator. The fix displays the legal prefix through
that terminal draw and discards continuation after the game ends; genuinely
illegal moves before termination are still rejected. All eight normalization
unit tests passed, and a one-off Linux worker with branch source replayed the
entire failed 154-ply game successfully. No main container or stored job changed.

Commands/logs: `/tmp/chesstutor-reproduce-quick.py`,
`/tmp/chesstutor-reproduce-quick-docker.log` (original failure),
`/tmp/chesstutor-quick-fixed.log` (complete Linux replay after the fix).
Independently reusable fix commit: `1929a2eba34c7cc7f173adbeb175363b947746c7`.

## Acceptance evidence and limits

First full `make verify` passed 305 tests: 133 Python unit, 106 frontend unit,
26 integration and 40 Chromium tests, plus contracts, static/format/function
checks and builds. Log: `/tmp/chesstutor-browser-verify.log`. Real WASM tests cover
both full builds, refinement, cached resume and zero server job submissions,
with a real Python chess-validation API and only discovery mocked.

A real previously imported 154-ply game was then exercised through Chromium and
branch validation against its actual canonical stored history. Browser profiles
were new, with local asset delivery. Results on the M1/8-GiB development machine:

| Path | Observed end-to-end | Completion status | Fully cached/revalidated rerun |
| --- | --- | --- | --- |
| Single thread | 14.459s including cancellation/resume | Screening run reported 11.9s | 1.828s |
| Two threads | 9.265s including local download/startup | Screening run reported 6.9s | 1.323s |

Both completed all 154 plies with zero server analysis submissions. Single-thread
cancellation retained completed positions and reaped its worker before resume;
all workers were gone after completion. This demonstrates the execution path,
not current Deep strength or Chess.com quality equivalence. No server game/job
record was changed by this acceptance run.

Harness: `node apps/web/scripts/browser-acceptance.mjs /path/to/imported-game.json`
after starting the experiment. Raw local log:
`/tmp/chesstutor-browser-acceptance-final.log`; screenshots:
`/tmp/chesstutor-browser-1.png`, `/tmp/chesstutor-browser-2.png`.

A post-review repeat while the aggregate gate also ran completed all 154 plies:
single-thread 24.721s including cancel/resume (cached rerun 2.366s), two-thread
10.791s (cached rerun 1.830s). Both again submitted zero server engine jobs.
Log: `/tmp/chesstutor-browser-acceptance-reviewed.log`. Concurrent host load and
time caps affect achieved node counts; these are smoke measurements, not an SLA.

The separately tagged `chesstutor-web-browser-experiment` image built with
`docker build -f apps/web/Dockerfile -t chesstutor-web-browser-experiment .`.
The image preserves the monorepo layout so both JS imports and preparation can
find the pinned manifest. Startup on temporary loopback port 5176 passed HTML,
COOP/COEP-header and 14-file provenance checks. The temporary container was then
stopped/removed; main images/containers were not replaced. Build log:
`/tmp/chesstutor-browser-docker-build.log`.

## Whole-branch review

Slash `/diff` and `/review` cannot be directly invoked. The fallback uses
`git diff 787ce2ee6436569e2643a4d122add5b4a4d4890a --`, including all staged new
files and pending changes, followed by independent Standards and Spec review.
Snapshot: `/tmp/chesstutor-browser-full.diff`.

Initial Spec review found no blocking mismatch; clarified that node targets also
have time caps. Standards requested moving HTTP logic into `src/api` and adding
deterministic orchestration tests through the approved public panel seam. HTTP
validation and asset downloads now live in API modules. Fake Worker/IndexedDB/
HTTP tests cover selected-first order, reuse versus restricted same-root search,
cache revalidation/rejection, refinement coverage and cancellation. A new test
reproduced a worker retained during blocked cache publication; lifetime abort
binding fixed it and all seven orchestration cases pass. The real WASM checks
retain download/hash/build coverage; unit tests fake that network boundary.

Repeat whole-branch Standards and Spec reviews after all fixes, packaging and
API-isolation changes reported zero remaining actionable findings. Final
`make verify` passed **315 tests**: 136 Python unit, 113 frontend unit, 26 real
integration and 40 Chromium tests, plus contract drift, static/format/function
checks and both builds. Log: `/tmp/chesstutor-browser-verify-isolated.log`.
The earlier 313-test gate also passed; the final run adds the two isolation cases.
One preceding run was interrupted during browser checks and is not counted as a
passed gate. No function-length exception or skipped test is introduced. A test-only locked
`fake-indexeddb` dependency supports deterministic storage boundary tests.
The three supporting research notes existed before the experiment and are
included unchanged as its source context.

Cross-device Windows/Linux x86, Android/iOS, 30-game performance, stronger-reference
quality calibration, human chess review and detailed manual accessibility gates
remain open. No production rollout, native multi-architecture packaging or S4
completion is claimed. The experiment is left running on 5175 with validation on
8001; temporary packaging containers are removed. Screenshot inspection and
relative documentation-link/whitespace checks passed. No screen-reader session
or cross-device measurements are inferred from automated viewport assertions.
Feature checkpoint: `0ec6ead68999696557d4d82a9ad1670c4cf01d48`
(`feat(experiment): run full Stockfish reviews in browser workers`). The Quick
fix is a separate ancestor commit recorded above. Both coherent commits include
their necessary tests; the feature commit also includes contracts, provenance
and documentation. Explicit paths were staged and the staged diffs inspected.
This documentation-only follow-up records the final feature ID; its own ID is
available in Git history. At that checkpoint, `main` remained at the fixed
starting commit and the working branch was `experiment/browser-stockfish`.

## Authorized main merge verification

On 2026-11-03 the user requested proof that Stockfish computes analysis rather
than only updating sidebar progress, followed by merging into main. This
supersedes the original branch-only constraint, while retaining the opt-in
browser mode and all provisional-quality/adoption limitations above.
Pre-merge branch checkpoint: `1fb6927`; main baseline remains
`787ce2ee6436569e2643a4d122add5b4a4d4890a` for the whole-change review.

The real-WASM Playwright tests now observe actual worker messages without
replacing its script or outputs. Both full builds must identify Stockfish 17.1,
complete the UCI handshake, and return search output with positive depth/nodes,
a score, PV and bestmove. Raw UCI transcripts are attached to the test results.
The resulting evidence still passes the real Python legality endpoint and is
rendered in the variations panel. A negative control blocks WASM downloads:
analysis must fail with zero available plies, no variations, no evidence requests
and no live worker. All three targeted cases passed before the full gate.

Slash commands remain unavailable. Equivalent whole-change Git diff and parallel
code-review skill reviews against AGENTS.md and the PRD reported zero actionable
Standards findings and zero actionable Spec findings. The reviewed diff includes
the original experiment, Quick fix and new proof tests, not merely this follow-up.
Diff snapshot: `/tmp/chesstutor-browser-merge.diff`.

Final pre-merge `make verify` passed **316 tests**: 136 Python unit, 113 frontend
unit, 26 database/Redis integration and 41 Chromium tests, plus contract drift,
static/format/function checks and builds. Log:
`/tmp/chesstutor-browser-merge-verify.log`. Documentation links resolve and
`git diff --check` passes. No production application behavior changed in this
follow-up. Explicit test/doc paths were staged and inspected together.
The proof-test/evidence commit is identified by Git history; main will advance
by fast-forward to that reviewed checkpoint without rewriting history. No remote
push or deployment is included. Browser mode remains opt-in; human chess review,
manual accessibility, cross-device and quality calibration gates remain open.
