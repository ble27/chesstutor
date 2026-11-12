# S5 handoff: grounded coaching

Read first: `AGENTS.md`, `docs/PRD.md` (sections 6 and 7), `plan.md` (S5), and
`docs/sprints/S5.md` (full evidence). S5 is **not complete**; the items below remain.
The PRD is the product authority, and this note does not waive any gate.

## What was done (summary)

- **Engine:** Stockfish 19 pinned (digest-keyed archive cache, bound-score handling).
- **Coaching domain** (`services/core/coaching/`): detectors, reviewed templates and typed
  substitutions only, six intents, a refusal path, and an injected optional model
  callable (10 s deadline, two calls max). No free text reaches the learner.
- **API and UI:** `/lessons` and `/coach` endpoints, a guidance tab, board arrows from
  legal complete PV lines (played arrow in red, at most two suggested in green), runtime
  validators, and 4 browser cases.
- **Lessons only for notable plies:** Miss, Mistake, Blunder, Great, Brilliant. Wording is
  plain, with no algebraic notation, and at most two alternatives.
- **Classification policy v3** (PRD section 6, commit `8f8951f`): labels follow pawn-swing
  bands (0.5 inaccuracy, 1.0 mistake, 2.0 blunder), tempered by the WDL band (the less
  severe wins). A Blunder also needs 3 or more material points lost, a mate allowed or
  missed, or a drawn/winning position turned losing. Winning the same material another
  way is at most an Inaccuracy. Miss also covers a free capture the move did not itself
  make. The version is `v3` everywhere (labels, proofs, stored-job compatibility, web).
- **Specific coach notes** (`coaching/motifs.py`, `phrases.py`): flaw notes name what the
  opponent's reply allows (mate, lost piece, fork, skewer, pin, discovered attack or check,
  the center, weakened king, replying piece). Great, Brilliant and Miss notes name the
  proven idea (fork, pin, rescued piece, open file, and so on).
- **Human review sheet:** `scripts/review_sheet.py` (pure helpers) and
  `scripts/coaching_review_packet.py` (engine IO) generate
  `docs/sprints/S5-review-sheet.md` plus board images in `docs/sprints/s5-review/`.
  Regenerate with `uv run python -m scripts.coaching_review_packet --games 8
  --max-plies 50 --mode deep` (about 11 minutes, run it in the foreground; background
  launches were killed in this environment).

Last gate state: Python unit 479 passed and 43 failed; web unit 183 passed and 23 failed.
All failures are inherited future-sprint specs (S7 Python, S6 web), and no S4/S5 test
fails. ruff, mypy, function lengths and contract regeneration pass. **Integration and e2e
were not rerun after policy v2/v3** (Docker daemon was unavailable).

## Remaining tasks (in order)

1. **Record the human review verdict.** The user reported that the majority of the
   classification looks correct and that finer calibration can come later. This is *not*
   the formal gate result. The gate needs at least 27 of 30 annotated rows marked
   correct and actionable and zero illegal or confidently false claims. Ask the user to
   fill the table columns in `docs/sprints/S5-review-sheet.md` (or state the tally), then
   record it in `docs/sprints/S5.md`. If they accept "majority correct" as the S5
   sign-off, record that decision and wording verbatim and note the gate as waived by
   the user, not passed.
2. **Rerun the full gate** once Docker is up: `make up`, then `make verify`. Expect the
   inherited S6/S7 spec failures to stop it at the unit step; run
   `uv run pytest tests/integration -q` and `make test-e2e` directly and record the
   results. `make up` also rebuilds the worker images on Stockfish 19, which was never
   done. Integration expects about 34 tests to pass.
3. **Optional llama.cpp model adapter (PRD section 7).** Not built. The coach already
   takes an injected callable (`services/core/coaching/requests.py::ask_model`). The
   adapter must enforce the 10 s deadline itself, validate output against reviewed
   template ids and typed values, and never expose model prose. Skip it if the PRD marks
   it optional for the S5 gate, and record that decision.
4. **Manual accessibility check** of the guidance tab and arrow contrast (keyboard,
   screen reader text equivalents for arrows, red/green not the only cue). Record the
   result as manual evidence in `S5.md`.
5. **Detector coverage and note quality (optional, after the verdict).** Known weak spots:
   - Some mistake notes only name the opponent's replying piece ("lets the opponent's
     queen go to a5"). More causes (development lag, king safety, trapped piece) would
     help.
   - A Blunder justified by a mate or flipped result can be explained by a smaller
     hanging pawn.
   - The "weakened king" and "center" causes are heuristics keyed to the engine's reply.
6. **Run the repository's equivalent of `/diff` and `/review`** against the sprint-start
   commit `ed099a4af91e9d928a27d65904d2b2f80b23e834` (slash commands are unavailable),
   resolve findings, rerun the gate, and update `docs/sprints/S5.md` with the final
   commit IDs. Then mark S5 complete.

## Known limits (do not describe as solved)

- Pawn-swing thresholds (0.5 / 1.0 / 2.0), the -0.5 / -1.5 flip limits and the 3-point
  material rule are product choices to calibrate on annotated fixtures.
- The question gate is keyword-based. The application layer imports API schemas.
- The browser WASM experiment is still Stockfish 17.1. Ask the user before upgrading it.
- The review sheet's games vary with engine timing, so they are not reproducible move for
  move. Regression cases live in `tests/unit/test_swing_policy.py`,
  `test_blunder_policy.py`, `test_lesson_reasons.py` and `test_badge_verification.py`.

## Repository cautions

- Another contributor has uncommitted or staged work on the library UI (`apps/web/src/
  features/library`, `App.tsx`, `Discovery.tsx`, `docs/ui-library-redesign.md`, and
  related Python under `services/adapters/player_ratings.py` and the like). Do not
  stage, revert or edit it. Commit with explicit pathspecs
  (`git commit -- <paths>`) so their staged files are not swept in.
- Commit `cd2c50c` included the regenerated `contracts/openapi.json`, which contained
  their `PlayerRatings` endpoint before their code was committed. They have since
  committed the UI redesign; rerun `make contracts-check` to confirm there is no drift.
- `make check` may fail Prettier on their in-progress files, not on S5 files.
- Never amend or reset shared history. Use Conventional Commits.

## Entry gate for S6 (complete UI and accessibility)

Do not start S6 until: the S5 verdict is recorded (or explicitly waived by the user),
`make verify` plus integration and e2e results are recorded, the manual accessibility
evidence exists, and `docs/sprints/S5.md` names the final reviewed commit. The 23 web
failures (`futurePresentation`, `futureVariation`) are S6's inherited specs and become
S6 work.
