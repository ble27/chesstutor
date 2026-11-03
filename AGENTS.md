# Contributor and agent conventions

These rules apply throughout this repository. Product scope and acceptance
criteria are in [docs/PRD.md](docs/PRD.md). Sprint 0 establishes the application
foundation; see `Makefile` and `docs/sprints/S0.md` for commands and gate evidence.
The remaining sprint sequence is in [plan.md](plan.md); the PRD remains the
product authority.

## Scope and workflow

- Implement only the requested change and the current approved sprint.
- Read relevant code and tests before editing. Reuse existing behavior before
  adding a dependency, abstraction, service, or configuration option.
- Keep changes small and reviewable. Do not modify unrelated files, the parent
  repository, or another contributor's work. Never discard uncommitted changes.
- Keep the PRD, API contract, and sprint evidence consistent with behavior.
- Record assumptions and concrete limitations. Do not describe planned features
  or unrun checks as implemented or verified.

## Clarity and modularity

- Prefer explicit, readable code over cleverness or unnecessary generalization.
- Give each function one clear responsibility, typed inputs, and an explicit
  result. Name values for their chess or application meaning.
- Target 20–40 lines per function. A function, method, callback, or component
  must not exceed 100 physical lines, including its body, comments, and blanks,
  unless a mandatory technical constraint makes splitting materially worse.
- Before exceeding 100 lines, try extracting cohesive helpers. For a mandatory
  exception, add a nearby `length-exception:` comment stating the constraint and
  record the reason and verification in sprint evidence. Convenience is not a
  reason. Do not evade the limit with compressed statements or giant expressions.
- Modules should own one coherent concern. Separate chess rules, analysis,
  classification, coaching, transport, persistence, and presentation.
- Domain code stays independent of HTTP, database, queue, engine-process, and UI
  frameworks. Inject side-effect boundaries; avoid hidden global state.
- Prefer composition and plain data structures. Introduce an abstraction only
  when a concrete boundary or repeated behavior justifies it.
- Comments explain constraints and reasoning; code should explain routine steps.

## Python and TypeScript

- Python: type public interfaces, use small typed models/dataclasses, and keep
  async HTTP work separate from CPU/subprocess work. Run Ruff and mypy.
- TypeScript: enable strict mode, avoid `any` and unchecked assertions, narrow
  unknown input, and use discriminated unions for lifecycle and score states.
- Keep React components focused. Put request logic in the API layer and state
  transitions in testable hooks/reducers. Do not duplicate backend chess rules.
- Pydantic/OpenAPI is the API contract source. Regenerate client types and verify
  drift. Runtime-validate network boundaries; types alone do not validate data.
- Use explicit units, UTC storage, and deliberate display formatting. Distinguish
  full-move numbers, plies, centipawns, mate distance, seconds, and milliseconds.
- Keep dependencies/toolchains pinned with lockfiles. Document added dependencies
  and avoid introducing a second tool for an existing responsibility.

## Safe boundaries and chess correctness

- Treat username, source URLs, PGN, metadata, questions, and model output as
  untrusted. Validate shape, length, size, domain, and permissions at entry points.
- Build only allowlisted upstream URLs; check redirects. Bound decompressed input,
  requests, retries, execution time, memory, process counts, and queue size.
- Never interpolate user input into SQL or shell commands. Launch a trusted engine
  with argument arrays and no shell. Close/reap subprocesses on every exit path.
- Keep secrets in server-side environment/configuration, never Git or frontend
  bundles. Redact logs and avoid storing free-text questions by default.
- Escape external text; do not render untrusted HTML or execute model-provided
  code, URLs, commands, or instructions. Apply origin/CSRF and job-owner checks.
- Validate PGN parser errors and all moves; preserve setup FEN and history.
  Keep score POV explicit and mate scores separate from centipawns.
- Replay every displayed engine line legally. Use versioned classification rules
  and evidence-backed advice; insufficient evidence must remain uncertain.
- Render coaching through reviewed chess templates and typed chess values only.
  Reject unrelated/mixed requests. Prompts are not a domain-enforcement boundary.
- Make retryable writes idempotent. Handle transaction, cancellation, and stale
  worker races explicitly. Add reversible migrations and recovery instructions.
- Preserve dependency notices and exact engine/model provenance before packaging.

## Tests and sprint gates

- Each sprint includes meaningful unit tests for every changed decision-bearing
  layer, plus its documented integration/browser acceptance checks.
- Keep unit tests deterministic: fake HTTP/UCI/clocks and use small legal fixtures.
  Isolate optional live smoke checks from CI and never call paid services in tests.
- For bug fixes, add a regression test when it can meaningfully reproduce the
  failure. Assert observable behavior rather than private implementation details.
- Test engine legality and qualitative outcomes with tolerances; avoid exact
  scores, depths, nodes, or timings that vary across hardware.
- At Sprint 0, introduce the documented check/test/build commands. Run applicable
  static checks and tests for every change, and the complete required gate before
  marking a sprint complete.
- If a gate fails, stop dependent sprint work. Diagnose, fix, and rerun until it
  passes. Never skip tests, suppress failures, or weaken assertions to advance.
- Record commands, results, acceptance evidence, known limits, mandatory function
  length exceptions, and commit IDs in `docs/sprints/S<n>.md`.
- For documentation-only work, check consistency, links, and whitespace; do not
  invent runtime test results or add trivial tests merely to claim coverage.

## Sprint completion workflow

1. Before editing, record the sprint-start commit in `docs/sprints/S<n>.md`.
   Use that fixed commit throughout sprint review, including after intermediate
   commits; never use current HEAD as its own comparison baseline.
2. Write meaningful failing tests first to demonstrate missing behavior, implement
   the behavior, and confirm those tests pass. Committed checkpoints must pass.
   Documentation-only changes follow the documentation checks above.
3. Run `make verify` and all sprint-specific acceptance checks before marking a
   sprint complete. Human chess review and required manual accessibility checks
   remain explicit gates; automated checks do not replace them.
4. Run `/diff`, then `/review`, against the whole sprint: all committed and pending
   changes since the recorded sprint-start commit, including new files.
5. If slash commands cannot be invoked, explicitly report the limitation and
   provide the equivalent Git diff and code review against this file, the PRD,
   and sprint acceptance criteria. Compare the recorded baseline to the complete
   working tree, accounting for untracked files as well as tracked changes.
6. Resolve review findings, rerun affected checks, and repeat the full gate after
   code changes. Failed or unavailable required checks block completion and
   dependent sprint work; record limitations rather than claiming success.
7. Commit atomically by coherent behavior, including necessary tests and docs.
   Stage explicit paths, inspect the staged diff, and exclude personal
   configuration.
8. Record baseline/final commit IDs, commands, results, review findings and their
   dispositions, limitations, and manual evidence in `docs/sprints/S<n>.md`.
   If the evidence commit cannot name itself, record the final implementation
   commit and identify the evidence commit through Git history.

## Git discipline

- Use Conventional Commits: `docs`, `chore`, `feat`, `fix`, `test`, or `refactor`,
  optionally with a concise scope, followed by a specific imperative summary.
- Commit coherent changes with their necessary tests and documentation. Check
  the staged diff; stage explicit paths rather than unrelated working-tree files.
- Never commit credentials, runtime databases/caches, large raw archives, engine
  binaries, or model weights. Keep source fixtures small and attributable.
- Do not amend, reset, force-push, or rewrite shared history unless requested.
- A commit does not prove a sprint passed; the recorded gate evidence does.
