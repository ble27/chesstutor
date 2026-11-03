# S3 handoff — Bounded Stockfish jobs

Status: prepared; S3 implementation has not started.

## Entry gate

The [S2 record](S2.md) tracks the automated checks and the user-requested layout
follow-up. Required manual keyboard and screen-reader acceptance remains pending.
Record actual tester/browser/screen-reader results there before marking S2
complete or beginning dependent S3 implementation. Automated accessibility-tree
assertions and screenshots do not replace that gate.

When the gate is satisfied, record the then-current commit as the S3 baseline in
`docs/sprints/S3.md` before editing. Do not reuse S2's baseline or compare HEAD to
itself. Follow the [completion workflow](../../AGENTS.md),
[S3 plan](../../plan.md), and [product requirements](../PRD.md).

## Current behavior and boundaries

- Imported FEN/SAN/UCI sequences drive exact, read-only replay. Desktop shows a
  viewport-bounded board with orientation-matched player labels beside recorded
  moves and distinct engine/coaching panels. Smaller screens stack the panels.
- The move list contains recorded game moves, not evaluations or engine lines.
  Engine analysis and coaching still explicitly report unavailable.
- [Replay](../../apps/web/src/features/replay/Replay.tsx) owns selection and
  orientation. Keep selection available during analysis and do not reset it
  when polling returns evidence.
- [InsightPanels](../../apps/web/src/InsightPanels.tsx) holds the current engine
  and coaching placeholders. Replace only the S3 engine placeholder in S3;
  classification/coaching remain S4/S5.
- No API contract or database schema changed in the S2 layout follow-up.

## Implementation starting points

1. Agree on the S3 public test seams when using the TDD skill; S2's approval
   covered importer, replay component, and browser seams. Add meaningful failing
   tests at the chosen analysis/job interfaces, with fake UCI/clock boundaries.
2. Use the [pinned Stockfish manifest](../../engines/stockfish.json) for verified
   installation and exact binary/NNUE provenance. Installation, execution, and
   WDL readiness are still unimplemented. Preserve history and reap processes on
   every cancellation, timeout, and failure path.
3. Add analysis domain values and worker orchestration. The
   [existing worker](../../services/worker/main.py) only listens on the RQ
   `analysis` queue with JSON serialization; it does not implement analysis jobs.
   Reuse [settings](../../services/api/app/settings.py) and existing boundaries.
4. Extend the [game store](../../services/adapters/game_store.py) with durable
   analysis/evidence persistence at a cohesive boundary; add reversible Alembic
   migrations. Test duplicate dispatch, enqueue failure, crash recovery, stale
   attempts, cancellation, and retry against real PostgreSQL/Redis.
5. Introduce signed session ownership, CSRF/origin protections, quotas and queue
   bounds before exposing submission/cancellation. Add the PRD's create/read/cancel
   API, typed lifecycle/score/progress/evidence contracts, polling and runtime
   response validation. Regenerate and check OpenAPI/client types.
6. Implement exact PRD Quick/Deep budgets, explicit mover/White score POVs,
   separate mate/centipawn states, missing-WDL/partial states, and legal PV replay.
   Run `make verify`, real pinned-engine checks, responsiveness/runtime
   measurements, and the complete S3 acceptance gate before completion.

Automatically perform whole-sprint `/diff` then `/review` after verification;
when unavailable use the documented Git diff and Standards/Spec review fallback.
Resolve findings, rerun affected checks, and repeat the full gate after code
changes. Commit coherent behavior with tests/docs and record exact checkpoints.
