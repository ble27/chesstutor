# Remaining sprint implementation plan

[docs/PRD.md](docs/PRD.md) remains the product authority. This plan sequences the
remaining work; it does not change product scope or certify acceptance gates.
Follow [AGENTS.md](AGENTS.md) for implementation and completion workflow and the
[Makefile](Makefile) for verification commands.

## Approved review workspace correction

Implement [the review workspace plan](docs/unified-review-plan.md) on
`design/unified-review`, starting at `198f997`. Preserve the original teal/cream
board colors. The brown-board screenshot is a layout reference only. Desktop
uses approximately 60% board / 40% analysis workspace, never equal columns.
The right workspace owns Analysis, Review, and future Chess guidance tabs,
recorded moves, and persistent navigation. Display only engine-supplied scores
for the matching position; never insert illustrative evaluation numbers.
This explicitly requested UI work does not certify S4/S6 or waive open gates.

## Baseline and execution

At planning baseline `13ebdc9`, S0–S1 are complete and S2–S7 are unimplemented.
The [S0 record](docs/sprints/S0.md) and [S1 record](docs/sprints/S1.md) contain the
historical evidence. S1 previously passed 140 tests and its full local gate;
this is not a newly run gate. Remote CI and optional live PubAPI smoke were not
run. This documentation task changes only `plan.md` and `AGENTS.md`; it includes
no sprint implementation or new runtime verification.

Proceed sequentially from S2, completing each gate before dependent work.
Record each sprint's own start commit before editing, rather than assuming this
planning baseline is its start. For every sprint below, write the initial
failing tests before implementation. These tests must demonstrate missing
behavior; committed checkpoints must pass. Use deterministic fake HTTP/UCI/clocks
for unit tests and real dependencies for the required integration checks.

Each sprint requires `make verify`, its acceptance checks below, and whole-sprint
diff/review from its fixed start commit, covering committed and pending changes.
Record evidence in `docs/sprints/S<n>.md` when that sprint begins. Human chess
review and required manual accessibility checks remain explicit gates. Failed
or unavailable required checks block completion and dependent work.

## S2 — Exact replay

**Implementation:** Add a small `react-chessboard` adapter, replay state,
synchronized move selection, first/previous/next/last controls, board flip,
focused keyboard navigation, and responsive panel skeletons. Reuse the imported
starting FEN and complete FEN/SAN/UCI sequences; do not duplicate backend rules.

**Tests to write first:** Exact fixture positions after castling, en passant,
promotion/underpromotion, mate/draw, and Black-to-move setup; forward/backward
navigation and endpoint bounds; board/move synchronization; flip preserves the
selected ply; focused Arrow/Home/End navigation does not intercept input fields.

**Completion criteria:** Every fixture position matches in both navigation
directions. Selection and board remain synchronized. Browser checks show no page
overflow at 320/390/768/1024/1440 CSS px. Manual keyboard and screen-reader checks
confirm usable textual position alternatives.

## S3 — Stockfish jobs

**Implementation:** Add pinned-engine installation/readiness, Quick/Deep presets,
durable analysis/evidence storage, RQ dispatch/reconciliation, polling,
cancellation, retry, and crash recovery. Introduce session ownership, origin
checks, quotas, and queue limits before exposing engine submission. Preserve
history, record exact engine/NNUE provenance, and legally replay displayed PVs.

**Tests to write first:** Wrong mover POV; mate treated as centipawns; missing WDL
or illegal PV accepted; fake-UCI options/budgets and deadlines ignored; duplicate
submissions consume extra work; enqueue failure loses jobs; stale attempts
overwrite results; unauthorized cancellation succeeds; cancellation leaves
engines running. Cover lifecycle/cache versions and frontend progress,
cancel/retry, and stale-game responses.

**Completion criteria:** Pinned-engine and real PostgreSQL/Redis integration pass,
including draw history, duplicate dispatch, enqueue failure, recovery, and worker
races. Preset budgets match PRD section 6: Quick 100ms per search/MultiPV 2,
Deep 750ms/MultiPV 3, plus same-root restricted played-move searches; deadlines
90/540 seconds, one thread and 128 MiB hash per engine. Partial jobs remain
partial; cancellation reaps processes. API stays responsive and measured
runtimes are recorded.

## S4 — Classification

**Implementation:** Add versioned base labels, evidence-backed Miss/Great/Brilliant
badges, coverage-aware per-player summaries, and critical moments. Implement the
PRD's precedence, badge exclusions/conflicts, and bounded verification policy.

**Tests to write first:** Incorrect expected-score-loss boundaries at
0.02/0.05/0.10/0.20; wrong forced/best precedence; color asymmetry; unstable or
missing evidence classified; mate transitions; unsupported sacrifices or misses
awarded badges; trivial recaptures or already-lost pieces qualify; badge
conflicts; exhausted verification budget still awards badges; incomplete jobs
receive final summaries.

**Completion criteria:** Annotated fixtures match PRD policy. Supporting
variations are legal. Real-engine checks use qualitative assertions and
tolerances, not exact scores. UI identifies independent classifications,
heuristic brilliance, and Quick results as provisional relative to Deep.

## S5 — Grounded coaching

**Implementation:** Add evidence detectors, reviewed templates, supported intents,
both-player advice, beginner/intermediate wording, and game improvement. Add an
automatic beginner-friendly lesson only for Miss, Mistake, Blunder, and notable
good plies, worded in plain language rather than algebraic notation, with one or
two practical alternatives, and typed arrows for at most two legally replayed
engine PV first moves with a text equivalent. Keep
the private model adapter optional; core coaching works without it. Render only
reviewed templates and validated typed chess values.

**Tests to write first:** Unsupported claims rendered; illegal alternatives
suggested; absent evidence produces confident advice; wording ignores level;
a lesson that contradicts its stored label or shows Brilliant without the badge;
an arrow from an illegal, bounded, or non-PV move; a routine ply annotated; more
than two alternatives suggested; algebraic notation in primary lesson text; unrelated/mixed or unsupported requests answered; injected PGN, username, or chat
instructions followed; invalid model evidence IDs, schema failures, or timeouts
reach output. Cover all supported intents and evidence-to-template mappings.

**Completion criteria:** The adversarial corpus passes. Human review of at least
30 positions achieves ≥90% correct/actionable guidance, with zero illegal moves
or confidently false tactical claims, per the PRD rubric. Only reviewed templates
and validated chess values reach rendering. Core coaching works with the model
disabled; browser supported-question, refusal, and outage cases pass. Record
unsupported detector coverage rather than claiming comprehensive guidance.

## S6 — Complete UI/accessibility

**Implementation:** Finish the gray-gradient workspace hierarchy, variations and
return, loading/empty/error/partial states, quota feedback, evaluation formatting,
and accessible interactions. Extend existing components within PRD scope.

**Tests to write first:** Evidence belongs to the wrong ply; leaving a variation
loses original selection; pending output appears complete; failed/partial states
mislead; mate or White-perspective scores are misformatted; controls lack
accessible labels.

**Completion criteria:** The complete username → game → Quick → replay → coaching
→ Deep → cancel/retry browser journey passes. Verify 320/390/768/1024/1440 CSS px,
contrast, 200% zoom, reduced motion, touch targets, focus, and screen-reader
announcements with automated and required manual checks. Follow PRD layout and
WCAG 2.2 AA targets, including normal-text contrast ≥4.5:1 and touch targets ≥44px.

## S7 — Release reliability

**Implementation:** Finish retention/purge, observability/redaction, deployment and
recovery documentation, notices/provenance, capacity measurements, and security
and load regression coverage. Verify and tune the S3 quotas/backpressure rather
than deferring submission protections until release.

**Tests to write first:** Quota windows/cache accounting are wrong; queue capacity
is exceeded; retention deletes active data; logs expose questions/secrets;
cross-session or cross-origin mutations succeed; upstream host/redirect checks
regress; backup restoration or migration rollback fails.

**Completion criteria:** Full regression/coaching suites and clean-checkout
startup pass. Verify load, crash/cancel/process cleanup, backup restoration, and
migration rollback. Benchmark at least 30 games on a documented 4-vCPU/8-GiB host
with two workers: idle-worker 80-ply p95 Quick ≤45s, Deep ≤240s; cached application
read p95 ≤500ms. Record measurements and limitations, not estimates as results.
Unmet release gates block release; do not silently reduce analysis to meet them.

## API and compatibility rules

- Preserve S1 discovery/import contracts. S2 reuses `GET /games/{game_id}`.
- Under the existing `/api/v1` prefix, S3 adds `POST /analyses`,
  `GET /analyses/{analysis_id}`, and `POST /analyses/{analysis_id}/cancel`, with
  typed lifecycle, score, progress, and evidence contracts from PRD section 8.
- S4 extends analysis responses; S5 adds `POST /coach` with the PRD's supported
  intents and validated game/analysis, ply, player color, and explanation level.
- Pydantic/OpenAPI remains the contract source. Regenerate OpenAPI/client types
  whenever contracts change, verify drift, and runtime-validate frontend responses.
- Add reversible migrations for affected persistence changes and verify recovery.

## Documentation change verification

For this planning change, check PRD consistency, relative links, and whitespace;
inspect the complete diff from `13ebdc9` and commit only `plan.md` and `AGENTS.md`
together. Do not claim a new runtime gate. If `/diff` and `/review` cannot be
invoked, report that limitation and perform equivalent Git diff and review
against the contributor rules, PRD, and this task's acceptance criteria.
