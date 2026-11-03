# Cross-platform free analysis architecture

Researched 2026-11-03. Proposal only: no runtime changes or benchmarks. This
supplements [performance](research-analysis-speed.md) and
[hosting](research-engine-hosting.md) research. The current PRD remains authoritative;
browser execution and revised search policy require an approved scope change.

## Recommendation

Build a browser-first analysis service using full-strength Stockfish WebAssembly
in a Web Worker, with an optional native worker for self-hosting and durable jobs.
Make ARM64 and x86-64 equal targets. Native ARM was an optimization for the current
development machine, not an appropriate product restriction.

WebAssembly is a portable compilation target; the browser handles the host CPU.
This makes one browser delivery path suitable for both instruction architectures,
subject to testing actual browser capabilities.
[WebAssembly project](https://webassembly.org/).
The client architecture need not match a remote server's architecture either.

This is a sustainability recommendation: users provide analysis CPU, avoiding a
central per-game compute bill. It does not mean zero total cost: users consume
electricity/battery and the operator still hosts downloads, imports and optional
accounts. Do not promise unlimited free cloud computation.

| Execution path | Proposed role | Tradeoff |
| --- | --- | --- |
| Browser WASM | Default free game review on ARM and x86 | Device-dependent speed; downloads and tab lifecycle matter |
| Native local/self-hosted worker | Optional stronger sustained analysis and durable jobs | Installation and architecture-specific packaging |
| Operator cloud worker | Optional funded/limited service later | Compute, queueing and abuse costs grow with usage |
| Public engine API | Optional experiment/cache source | Availability and evidence compatibility outside our control |

## Browser implementation

Stockfish.js supplies full and lite WASM builds, each with single-thread and
multithread variants. Current full assets are approximately 94 MB; lite assets
are approximately 1.6–1.7 MB and use a weaker network. It communicates through
UCI over worker messages and documents modern desktop/mobile browser support.
Choose full for the accuracy target; offer lite only as explicitly different
quality, not as a transparent substitute. Pin exact assets rather than a moving
release. Cache the full download and expose download progress.
[Stockfish.js maintained README](https://github.com/nmrugg/stockfish.js).

Ship separate threaded and single-threaded builds and select by tested browser
capabilities. Emscripten cannot make one pthread binary automatically fall back
to a non-threaded binary. Threaded operation requires SharedArrayBuffer and
correct COOP/COEP deployment headers; keep computation off the UI thread.
[Emscripten pthread documentation](https://emscripten.org/docs/porting/pthreads.html).
Audit imports, fonts and other cross-origin resources when enabling isolation.
Start with a conservative CPU/memory cap and a user control; benchmark thread
counts rather than assigning every reported logical core automatically.

Persist completed positions locally and resume after interruption. A worker does
not make the tab a durable server: browsers can freeze or discard pages under
resource pressure. Avoid promises that closed/background tabs finish a review.
[Chrome lifecycle documentation](https://developer.chrome.com/docs/web-platform/page-lifecycle-api).

## Analysis policy and accuracy

The current [PRD](PRD.md#6-analysis-presets-and-correctness) specifies two
same-root searches per ply and fixed time budgets. At 160 plies, nominal search
time is 32 seconds Quick or 240 seconds Deep before overhead. Changing ISA alone
does not remove these budgets. Browser execution alone is not a speed claim.

Proposed policy, requiring calibration:

1. Run a bounded node-budget screening pass with MultiPV 1, showing provisional
   coverage progressively. Prioritize the selected position.
2. Compare the best and played move from the same pre-move root. Reuse matching
   evidence only under explicit tested rules; otherwise search the played move.
3. Deepen unstable scores, candidate mistakes, tactical claims, near-threshold
   classifications and user-selected positions. Obtain alternative lines when
   needed rather than at every root.
4. Keep full setup FEN and move history, explicit score POV, separate mate values,
   raw WDL and legally replayed PVs. Do not treat adjacent FEN evaluations as a
   complete replacement for the current evidence contract.
5. Cache compatible results by game/history, engine/network/build/options and
   analysis-policy version. Do not merge lite/full or different provenance.

Node limits, time limits, Threads and MultiPV are supported UCI controls;
Stockfish recommends MultiPV 1 for performance. Equal nodes are a workload
measure, not a proof of equal strength across builds, positions or thread counts.
[Stockfish UCI documentation](https://official-stockfish.github.io/docs/stockfish-wiki/UCI-Protocol-and-Stockfish-Commands.html).

Keep execution provenance separate from search completion. Browser analysis can
serve the user's personal review, but uploaded client results are untrusted and
must not acquire server-verified badges or populate a trusted shared cache solely
because their shapes/PVs validate. Legal PVs do not prove genuine engine scores.
Use one versioned policy specification and shared conformance fixtures across
browser and Python implementations; explicitly resolve the current rule against
duplicating backend chess rules before moving classification into the browser.

## Optional native delivery

Publish Linux amd64 and arm64 images with a multi-platform manifest, using a
matching pinned native Stockfish binary in each. Docker selects a matching image;
forcing amd64 on ARM requires emulation. Keep OS/architecture/build hashes in the
existing provenance manifest. Test both architectures on native runners.
[Docker multi-platform documentation](https://docs.docker.com/build/building/multi-platform/).
Stockfish offers native Windows and Linux x86-64/ARM64 downloads as well as macOS
builds; engine support exists beyond the two artifacts currently pinned here.
[Official downloads](https://stockfishchess.org/download/),
[current project manifest](../engines/stockfish.json).
Desktop packaging can follow later; it is not necessary for browser access.

When distributing the engine, provide its license and corresponding source for
the exact delivered build, including modifications/build material as required.
Preserve notices and NNUE provenance. Packaging/licensing must be reviewed before
release, rather than treating a generic link to upstream HEAD as sufficient.
[Stockfish distribution requirements](https://github.com/official-stockfish/Stockfish/blob/master/README.md).

## Staged decision plan

1. Approve the browser-first product direction and update the PRD's execution,
   trust, persistence and quality contracts before implementation.
2. Prototype only the execution boundary: full WASM single/threaded versus native,
   with the same engine/network release, histories and policy. Do not conflate an
   engine upgrade with architecture comparisons.
3. Measure diverse games on an x86 Windows/Linux machine, ARM Mac, Android and
   iOS. Record cold download/startup and warm run separately, initial coverage,
   final evidence, memory, responsiveness, cancellation and resume behavior.
4. Compare both current Deep and proposed staged search with a substantially
   stronger reference. Track missed tactics/mates, false confident labels,
   classification stability, best-move agreement and uncertain coverage. Include
   human chess review. Use a held-out corpus after tuning budgets.
5. Ship only after quality and latency gates are defined and pass; no seconds-level
   or Chess.com-equivalence claim is established by this research. Retain deeper
   on-demand analysis and label incomplete/provisional results honestly.
6. Add native multi-platform self-hosting and only then assess demand/funding for
   shared server computation. Free-tier hosting is optional infrastructure, not
   the product's scalability premise.

Validation: checked cited primary pages, repository references and new-file
whitespace. No engine benchmarks or runtime tests were run for this research.
