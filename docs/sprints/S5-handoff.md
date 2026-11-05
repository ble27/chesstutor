# S5 handoff — entry blocked by S4 acceptance

S5 has not started. The user accepted the chess review on 2026-11-05; see
[S4 evidence](S4.md) and [S4-chess-review.md](S4-chess-review.md). S4 is still
not complete: its continuation is uncommitted, and the inherited future unit
specifications keep the full aggregate gate red. No handoff waives that gate
or grants permission to skip or suppress those tests.

Before implementation, resolve the remaining full-gate disposition,
record S5's own start commit, and follow [AGENTS.md](../../AGENTS.md),
[plan.md S5](../../plan.md#s5--grounded-coaching), and [PRD §7](../PRD.md#7-grounded-chess-only-guidance).

S4 starting points are persisted `ReviewedMove` records and typed `BadgeProof`
values in `services/core/classification/`. Proofs expose canonical roots, legal
checked lines, policy IDs, and the limited motifs established by bounded searches.
The game summary cites those proofs for its supported themes. These values are
inputs to future coaching, not reviewed prose or a general-purpose chess detector.
Do not trust browser-experiment client evidence as server engine verification.

S5 must add evidence detectors and reviewed templates, all six supported intents,
both-player beginner/intermediate wording, legal alternatives, uncertainty,
chess-only refusal enforcement, and an optional model interpreter with a shared
10-second deadline. The core must work without a model. Existing S5 specification
cases are in `tests/unit/future_sprints/`; adapt their proposed interfaces to the
approved typed domain boundaries while preserving their behavioral assertions.

Required gates remain the adversarial corpus, complete regression checks, browser
question/refusal/outage checks, and at least 30 positions reviewed by a competent
chess reviewer with the PRD's correctness/actionability rubric. None is certified
by this document. S6 and S7 follow only after their predecessors pass.
