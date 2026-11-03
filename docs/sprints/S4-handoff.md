# S4 handoff — Move labels and game summary

Status: prepared from the reviewed S3 implementation; S4 has not started.
Reviewed implementation checkpoint: `71fd90c92ffb6d845909ef98e8f05c07a8104a14`;
see [S3](S3.md) for 291 passing tests, final gate and review dispositions.

## Entry and scope

Start only after the [S3 gate](S3.md) passes and S4 is authorized. Record the
then-current commit as S4's baseline before editing. Follow [AGENTS.md](../../AGENTS.md),
[plan.md](../../plan.md) and the [PRD](../PRD.md), which remains authoritative.
S3's baseline must not be reused for S4 review.

S4 adds versioned independent base labels, evidence-backed Miss/Great/Brilliant
badges, critical moments, per-player counts and coverage-aware summaries.
Brilliance must be labeled heuristic. Coaching remains S5 and the completed
accessibility/workspace journey remains S6.

## Starting points

- [Analysis values](../../services/core/analysis/values.py) and the
  [runner](../../services/core/analysis/runner.py) provide ordered per-ply roots,
  both White/mover scores, WDL, expected loss, legal best/played variations,
  comparison stability and claimable/automatic draw evidence. Missing or unstable
  evidence must stay unclassified. Do not infer confidence from elapsed time.
- [Stockfish adapter](../../services/adapters/stockfish.py) owns bounded UCI
  searches; [score normalization](../../services/adapters/stockfish_scores.py)
  legally replays every variation. Verification searches need explicit PRD
  budgets and must share cancellation/deadline enforcement. Exhaustion must not
  award a badge. Keep pure classification rules separate from process/persistence.
- [Persistence](../../services/adapters/analysis_store.py) fences writes by token,
  preserves partial evidence, and allows one crash recovery under the original
  deadline. Use a reversible migration for persistence changes. Cache identities
  include engine, analysis, classification, feature versions and preset budgets.
  Replace the deliberate `pending-v1` classification provenance when implementing
  policy, and prevent incompatible cached results from receiving new labels.
- [Response schemas](../../services/api/app/analysis_schemas.py), generated
  OpenAPI/TypeScript and [runtime validation](../../apps/web/src/api/analysis.ts)
  must evolve together. Preserve S1/S2 contracts and S3's session challenge:
  no job is allocated until a signed cookie roundtrip, and the client retries
  that challenge only once. Never weaken ownership/origin/quota controls.
- [Engine panel](../../apps/web/src/features/review/EnginePanel.tsx) shows partial
  progress and pre-move evidence while replay selection stays fixed. Extend it
  with independent labels and explicit coverage; incomplete output must never
  look like a final full-game summary.

## Test-first and acceptance gates

Write meaningful failing tests first for exact loss boundaries 0.02/0.05/0.10/0.20,
forced/best precedence, both colors, mate transitions, unstable/missing evidence,
unsupported sacrifices/misses, verification-budget exhaustion and partial jobs.
Use annotated legal fixtures and qualitative engine assertions with tolerances.

Required human chess review of annotated classification fixtures is an explicit
gate; automated assertions do not substitute for it. Complete the S4 checks and
`make verify`, then whole-sprint `/diff` and Standards/Spec `/review` (documented
fallback when unavailable), resolve findings and repeat affected/full gates.
Commit coherent tested behavior and prepare the S5 handoff.

## Carried limitations

- S3 measurements are local short-game smoke checks, not S7 reference-host p95
  benchmarks. Compose on ARM uses the pinned x86-64 engine under emulation;
  native Linux ARM is unsupported. Engine options and budgets remain fixed.
- Manual screen-reader/zoom/contrast/reduced-motion/touch checks remain explicit
  S6 gates. User acceptance of S2 is recorded without invented manual details.
- S7 retention/purge, deployment/proxy hardening, transitive notice audit,
  capacity/load, backup restoration and release rollback gates are not waived.
