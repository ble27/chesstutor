# S4–S7 executable test specifications

Product authority: [PRD](../../../docs/PRD.md). Scope and workflow references:
[plan](../../../plan.md) and [AGENTS.md](../../../AGENTS.md). The user explicitly
authorized a tests-only branch **including failing cases**, overriding the normal
requirement that committed checkpoints pass. The user
confirmed the classification/summary, coaching/evidence, review UI, and
operations/security boundaries. These tests do not authorize production
implementation or certify any sprint gate.

Baseline: `2af357486f279c9104fb416091acb6668d25c377`, branch
`test/s4-s7-specification`. Uncommitted S3 changes in the original `main` worktree
are excluded. Rebase/adapt to the approved S3 contracts before implementing S4.
No production code, dependencies, generated contracts, or test configuration
changes are included. All cases execute normally; no skip, xfail, placeholder
assert-false, or replacement implementation hides missing functionality.

## Traceability

| Sprint | Requirement | Executable cases |
| --- | --- | --- |
| S4 | PRD §6 base labels, WDL loss/POV, instability, mate; plan S4 | `test_s4_classification.py` |
| S4 | PRD §6 Miss/Great/Brilliant eligibility, exclusions/conflict, 15% verification ceiling | `test_s4_badges.py` |
| S4 | PRD §§6,8 coverage, per-player averages/counts, critical moments, completed-only conclusions | `test_s4_summary.py` |
| S5 | PRD §7 all six intents, both colors, levels, legal alternatives, uncertainty, refusals, untrusted metadata and optional model bounds/fallbacks | `test_s5_coaching.py` |
| S5 | PRD §7 position-bound features, reviewed templates and explicit unsupported coverage | `test_s5_detectors.py` |
| S6 | PRD §§4,6,8 evaluation formatting, selected-ply/game matching, lifecycle/quota display, Quick provisional status | `apps/web/src/features/review/futurePresentation.test.ts` |
| S6 | PRD §4 variation navigation/return and flip independence | `apps/web/src/features/review/futureVariation.test.ts` |
| S6 | PRD §4 named controls, atomic announcements and editable keyboard regions | `apps/web/src/features/replay/FutureAccessibility.test.tsx` |
| S7 | PRD §§8,9 quota windows, cache accounting, active/queue limits, retention, sensitive log redaction and safe events | `test_s7_operations.py` |
| S7 | PRD §§3,8,9 source allowlist, rejected redirects, session/origin/CSRF authorization | `test_s7_security.py` |

## Proposed callable contracts

The PRD does not fix internal Python or TypeScript names. The following are
**proposed test seams**, not existing APIs or changes to the OpenAPI contract.
Only `source_url`, `PubAPI`, and `Replay` currently exist on this baseline.
Python case factories spell out all arguments; their NamedTuple inputs are
structural records. Implementations should own typed models/protocols and adapt
these tests to approved public interfaces, preserving the behavioral assertions.
They must not import test fixtures or accept unvalidated arbitrary model data.

| Proposed callable | Inputs | Observable result |
| --- | --- | --- |
| `services.core.classification.classify_move` | WDL records (wins/draws/losses/POV), mover, legal-move count, top-choice/evidence/PV/search facts, tagged raw scores | `base_label`, `expected_loss`, `policy_version` |
| `services.core.classification.award_badges` | Verified tactical/sacrifice/candidate facts, evidence IDs, preset and elapsed/remaining millisecond budgets | Tuple `badges`, `policy_version`, `evidence_ids`, `heuristic` |
| `services.core.classification.summarize_game` | Job state, total plies, classified moves with mover/loss/themes | Per-color `players` counts/averages, `coverage`, `is_final`, `game_conclusions`, `critical_moments`, supported `practice_themes` |
| `services.core.coaching.coach` | Validated game/analysis existence and bounds, FEN/ply/color/level/intent, question, position-bound evidence, untrusted metadata, optional interpreter | `status`, template `blocks`, `evidence_ids`, legal `continuation_uci`, `player_color`, `suggest_deep`, game advice `scope`/`supporting_plies`/`practice_themes` |
| `services.core.coaching.render_coaching` | Validated coaching result | Reviewed template text and typed chess substitutions only |
| `services.core.coaching.detect_evidence` | FEN, ply, validated continuation UCI | Records with `id`, `kind`, `squares`, `ply`, `fen` |
| `services.core.coaching.template_for_evidence` | Feature kind and explanation level | Supported reviewed `template_id`, or unsupported status/reason |
| `services.core.operations.admit_analysis` | Explicit UTC now, session/IP/preset/history, active sessions, queue count, cache status and IP limit | `allowed`, `reason`, `retry_after_seconds`, `engine_quota_cost` |
| `services.core.operations.plan_purge` | UTC now and records with timestamps/state/active references | `delete_ids` |
| `services.core.operations.source_cache_expired` | UTC now, provider expiry and fetch timestamp | Expiration bool |
| `services.core.operations.redact_log_event` | Structured event with nested untrusted values | Sanitized copy preserving safe observability fields |
| `services.core.operations.authorize_cancellation` | Owner/session, origin allowlist and validated CSRF fact | Authorization decision `allowed` |
| `reviewPresentation.ts` | Typed score or selected game/ply/evidence/lifecycle/coverage/preset/quota | White evaluation text, pending/available status, final/partial and retry/provisional metadata |
| `useVariation.ts` | Original ply/FEN/orientation, then server-validated variation positions | Bounded navigation, original selection restoration, independent orientation |

Coaching result blocks carry `template_id` and `evidence_ids`. Model inputs are
an injected callable receiving a question, `timeout_seconds=10`, and
`max_tokens=256`; its output is untrusted and permits at most two calls, including
one schema retry. There is no live interpreter or engine in these tests.

## Explicit assumptions and limits

- The literal policy-version value `v1` and lowercase internal label names are
  proposed encodings of the PRD's v1 policy, not an already published wire format.
- Incomplete/unstable comparisons return unknown loss; valid zero-loss values
  remain zero. Boundary fixtures use integer WDL totals and independent expected
  results to expose floating-point threshold errors.
- Badge facts represent already verified evidence; these are policy tests and
  do not prove tactical detection, compensation, or real-engine verification.
- Critical moments are ranked by expected-score loss when no other importance
  evidence is supplied. Themes must cite actual supplied plies. This ranking
  is an implementation proposal; the PRD fixes the maximum of three.
- Coverage averages exclude unclassified moves and remain unknown with no usable
  samples. Completed state with missing plies is rejected rather than finalized.
- Expiration is inclusive at 30/7 elapsed UTC days, using supplied `updated_at`;
  active/referenced game data survives purge. Durable cascade/transaction races
  require real database tests. Source caches follow provider expiry separately.
- UI decimal precision is one pawn decimal, zero is `0.0`, and negative mate is
  `-M3`; these extend the PRD examples. No personalized win probability is shown.
- The three concrete detector fixtures are hanging queen, knight fork and pin.
  Other listed themes must explicitly report unsupported until implemented.
  This is not the required 30-position human coaching evaluation.
- Cancellation policy tests receive a validated CSRF fact. They do not prove HTTP
  middleware, session cookies, ownership persistence, or mutation ordering.
- Variation FENs are server-validated input; the browser must not duplicate chess
  legality rules. Hook tests do not replace the board integration/browser journey.
- Missing future modules fail **at execution**, keeping all cases collectable and
  exposing each specification. Current failures demonstrate absent interfaces;
  their behavioral assertions will execute once those interfaces exist.

## Commands

With pinned dependencies installed using the repository's `make setup`:

```sh
uv run --frozen pytest tests/unit/future_sprints -q
uv run --frozen pytest tests/unit
npm --prefix apps/web test
make verify
```

The normal unit-test discovery includes these files. This branch is deliberately
red and must not merge as a passing implementation checkpoint. Sprint-specific
execution evidence and unrun acceptance gates are in `docs/sprints/S4.md` through
`S7.md`. Human chess review, real engine verification, browser/manual accessibility,
load/capacity measurement, durable races, backup restore, migration rollback,
notices/provenance and clean-checkout startup remain separate release gates.

## Fixed authority fingerprints

These SHA-256 values pin the exact files read at baseline `2af3574`:

| File | SHA-256 |
| --- | --- |
| `plan.md` | `c6376d6080578506fe39b3b4c24182035049a8f6e2cf9ef247c78e33ab3ca2d4` |
| `docs/PRD.md` | `968f9d8775ff043dacb56366b8d5e801146f2e1e968fa0e7e18789263384ba99` |
| `AGENTS.md` | `52cf73bc58afe97a629b136ddf563d173974d92f886779e221f07b2bd5d54de6` |

Final execution: **238 new cases: 20 passed, 218 failed**. Python new cases:
18 passed/194 failed; frontend new cases: 2 passed/24 failed. The full Python
unit suite had 113 passed/194 failed; the final full frontend unit run had
76 passed/24 failed. Contract/static/build checks passed; `make verify` remains
failed at Python unit tests. No sprint completion or release approval is implied.
