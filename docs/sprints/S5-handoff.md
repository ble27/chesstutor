# S5 handoff: grounded coaching

Read `AGENTS.md`, `docs/PRD.md` sections 6–7, `plan.md`, and the continuation
record in [S5.md](S5.md). **S5 is not complete. S6 and S7 have not started.**
The user explicitly kept the manual screen-reader gate open on 2026-11-12.

## Accepted decisions

The user reviewed the classification sheet and said:
"Accept majority correct and waive the numerical gate". This is a waiver of
the numerical review gate, not evidence of a 27/30 tally or a zero-false-claims
human verdict. Calibration remains a known limitation.

The user also authorized:
"Yes, use applicable sprint gates and require all green for S7". Deliberately
failing future-sprint specifications remain in normal test discovery and must
be recorded; they do not alone block an otherwise accepted earlier sprint.
All applicable and earlier gates must pass. S7 requires a fully green suite.

The screen-reader decision is:
"No, keep that manual gate open". Do not infer a waiver or begin S6 until the
remaining manual evidence is supplied or the user changes that instruction.
Automated keyboard/accessibility checks do not replace this gate.

## Delivered behavior and review fixes

- Pinned Stockfish 19; policy v3 throughout stored-job compatibility, labels,
  proofs and web validators. Pawn-swing bands are 0.5/1.0/2.0, tempered by WDL.
- Coaching uses reviewed templates and typed substitutions only, six intents,
  refusal and uncertainty paths, both colors/levels, and an optional injected
  model callable. The private llama.cpp adapter is omitted because PRD §7
  makes it optional; core coaching works with the model disabled.
- Notable automatic annotations remain selective. Selected-ply notes now cover
  all analyzed labels, including Good, Best, Inaccuracy, Forced and Unclassified,
  using reviewed templates and actual played pieces/squares. Previous/Next in
  Chess guidance updates the note without a chat request. The move list shows
  each reviewed ply's primary label and marks unprocessed plies Pending.
- Review now compares both named players in an ordered classification table,
  with zero counts, one primary label per ply and scored coverage. Independent
  Chess Tutor accuracy is `100 * (1 - average_expected_loss)` on scored moves;
  its formula is visible under "How these numbers work". Missing scores stay
  unavailable. The existing base-count API is preserved.
- Late coaching responses are cancelled and ignored after context changes.
  Arrows carry ply/root FEN and trigger an explicitly labelled pre-move board
  preview. Hiding arrows restores normal replay. Suggested-move text joins
  exact UCI matches to typed engine scores with explicit POV; unmatched scores
  say unavailable. Suggested arrows are bright green with a hard dark outline;
  the outline retains 3:1 contrast against both unchanged teal/cream squares.
- Pin explanations say a pinned piece cannot move **off that line**, avoiding
  a false claim for rooks that can move along the pin.
- Regression cases demonstrated missing behavior before the fixes. Whole-sprint
  Standards/Spec review used the fixed baseline below, including committed,
  pending and new files; dispositions and final checks are in S5.md.

## Remaining S5 gate

Manually check the guidance tab with keyboard and a screen reader: level and
player choices, suggested questions, free-text question, loading/error/retry
announcements, pre-move board description, and the move list that serves as the
text equivalent for arrows. Verify red/green is never the sole cue. Record the
actual reviewer, browser/reader, actions and result in S5.md. No spoken-output
check has been certified. Visual inspection and automated contrast evidence
must remain distinguished from this manual acceptance.

After that evidence exists, rerun applicable gates and whole-sprint review,
record final commit IDs, and only then mark S5 complete and start S6.

## Verification and review reference

S5 sprint-start baseline (fixed):
`ed099a4af91e9d928a27d65904d2b2f80b23e834`.
Continuation began at `5a4ca85808d6ac2ac229823895bb9440ec1ea3a2`.
The requested summary/selected-note/green-arrow expansion began at
`738d12b8d10b5d2a522f75782fb06df204f81d52`.
The implementation checkpoint and evidence commit are recorded in S5.md and
Git history. Slash commands are unavailable; use `git diff <baseline>` plus
untracked-file inventory and code review against AGENTS.md, PRD and sprint gates.

Docker Desktop was started and `make up` rebuilt both Stockfish 19 workers.
All 34 real PostgreSQL/Redis/RQ/engine integration cases passed. Final static,
unit, browser and build results, including unsuccessful attempts, are in S5.md.
Do not describe the aggregate gate as green while S6/S7 specifications fail.

## Known limits

- Thresholds and material/result-flip rules are product choices to calibrate.
- Some notes name only the replying piece; heuristic king/center explanations
  are not comprehensive strategic understanding. A mate/result-flip Blunder can
  still be explained by a smaller verified hanging piece.
- The question gate is keyword based. Application code imports API schemas.
- The opt-in browser WASM experiment remains Stockfish 17.1. Ask before upgrading.
- Review packet games vary with engine timing. Regression fixtures, not sampled
  game sequences, provide deterministic proof. The generated sheet is a snapshot,
  not a newly tallied human review.
- S6 manual accessibility and S7 release/benchmark/recovery gates remain unrun.

## S6 starting points after entry gates

Follow `plan.md` S6 and PRD §4/§10. The inherited 23 failing web cases in
`futurePresentation.test.ts` and `futureVariation.test.ts` specify presentation
and variation return. Extend existing `PositionEvidence`, `EnginePanel`, replay
and guidance components; do not implement isolated helpers just to satisfy tests.
Record the S6 start commit before editing. S7's 43 failing Python operations and
security specifications become work only after S6 passes.

Keep unrelated personal configuration and assets out of commits. The library
redesign is already committed; preserve it. Stage explicit paths, inspect staged
diffs, and never amend/reset shared history.
