# Repository review — 2026-11-04

Requested scope: document local setup and API endpoints, inspect ignore rules,
review current changes and input/security boundaries, scan for secret exposure,
and prepare the existing work for GitHub. Review baseline is
`ba00aa7d309e6ef43d6ef3b5002bbff6323c12bd`, the recorded S4 start. This is a
partial implementation checkpoint, not S4 completion or production approval.

## Findings and disposition

- Updated the existing README with current implementation limits, local setup,
  authoritative API endpoints, credential handling and actual gate status.
- npm audit initially reported seven moderate affected dependency entries for
  one minimatch advisory, [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).
  The development lint toolchain used minimatch 10.2.6. A scoped override pins
  11.0.1 beneath typescript-estree; the lockfile records the patched graph.
  Its new transitive helper's BlueOak license is retained. Static lint/type
  checks pass with the override. Reassess the override when upstream updates.
- API review found no concrete new injection, SSRF, ownership bypass or secret
  exposure in the S4 changes. Reviewed exact protected POST origins, signed sessions,
  owner-only cancellation, UUID/enumeration/body limits, upstream path/URL
  allowlists, redirect rejection, bounded uncompressed downloads, legal PGN/PV
  replay, parameterized ORM access, safe subprocess launch and React text output.
  These are reviewed boundaries, not a claim that every input is safe forever.
- Standards review found no actionable documented-standard violations. Spec
  review found S4 incomplete: pure badge policy tests pass, but live badge
  verification searches and practice themes are not connected. Preserve this
  limitation; do not describe those features as implemented.

## Ignore-rule audit

`git ls-files -ci --exclude-standard` reports no tracked files matching ignore
rules. The existing ignored inventory consists of local `.env`, environments,
Python/tool caches, dependency trees, build/test output, and generated engines.
The only ignored public directory content is generated `public/engine` assets;
`bin` contains the installed engine and generated license/provenance sidecars.
Source fixtures, contracts, manifests, migrations and both lockfiles stay tracked.

| Rules | Reason |
| --- | --- |
| `.env`, `.env.*`, except `.env.example`; `*.pem`, `*.key` | Local settings and private credential/key material; placeholders remain reviewable |
| `__pycache__/`, `*.py[cod]`, `.venv/`, Python tool caches, `*.egg-info/` | Reproducible bytecode, environments, caches and package metadata |
| `.coverage`, `.coverage.*`, `htmlcov/`, `coverage/` | Generated coverage results, including parallel shards added in this review |
| `node_modules/`, `dist/`, `*.tsbuildinfo` | Locked dependencies and reproducible builds |
| `playwright-report/`, `test-results/` | Generated browser reports and traces |
| `.cache/`, `*.log` | Tool/runtime caches and logs which may contain personal data |
| `/data/`, `/models/`, `/bin/stockfish*` | Root runtime data, model weights and installed engine artifacts |
| `.DS_Store`, `.idea/`, `.vscode/` | Personal OS/editor state |
| `apps/web/public/engine/` | Checksum-verified generated browser engine copies |

Anchored runtime paths prevent accidental exclusion of future nested source such
as `services/models/` or `tests/fixtures/data/`. `git check-ignore --no-index`
confirmed those paths and `.env.example` remain eligible, while `.env`, runtime
paths, coverage shards and generated browser engines remain excluded.

## Secret and dependency checks

An ad hoc pattern scan covered 216 tracked/untracked eligible files and all 349
unique reachable historical Git blobs before documentation additions. It looked
for GitHub/OpenAI/Slack/Google tokens, AWS access-key IDs, private-key headers,
and credential-bearing URLs with long non-placeholder passwords. No matches.
Ignored `.env` was inspected only for secret-valued settings without printing
values; it contained no non-placeholder secret/token/password/API-key values
eligible for the comparison. No credentials were added to the Git remote.

This is a bounded pattern scan, not a dedicated entropy scanner or guarantee of
no token leakage. Arbitrary passwords, unsupported token formats, external Git
objects, GitHub settings and deployed logs were not exhaustively audited.

Final `npm --prefix apps/web audit --json`: zero reported vulnerabilities.
`uv export --frozen --no-hashes --no-emit-project --format requirements-txt`
followed by `uvx pip-audit --disable-pip --no-deps -r <export>`: 45 Python
packages audited, zero known vulnerabilities; the Windows-only colorama entry
was inapplicable on this host. Advisory results describe the queried databases
on this date and do not certify vulnerability absence.

## Verification and release limits

- `make contracts-check` and `make check`: pass.
- `make verify`: stops at Python units, 251 passed and 109 failed. Failures are
  future S5/S7 specifications, retained without skips or assertion changes.
- Frontend unit suite: 133 passed, 23 failed in future presentation/variation
  specifications for unimplemented interfaces.
- `make test-integration`: 27 passed, three dependency/runtime warnings.
- Browser suites: initial run 40 passed/one 320px replay timeout; unchanged
  rerun 39 passed/two replay timeouts (320px and 1440px). Gate remains failed;
  no assertions or timeouts were changed. The unchanged 320px case passed
  alone with one worker (12.2 seconds); full-suite failure cause remains unproven.
- `make build`: Python sdist/wheel and frontend production bundle pass.

Browser result and implementation commit are recorded in [S4 evidence](sprints/S4.md).
Slash `/diff` and `/review` are unavailable in this interface; equivalent whole
working-tree Git diff plus independent Standards and Spec reviews cover the
fixed baseline, including untracked files. Review corrected README wording to scope Origin enforcement precisely to
protected POSTs; public game GETs may persist imported public data. New
documentation was checked for local links and whitespace. No production deployment, paid service, history
rewrite, gate suppression or dependent sprint implementation is part of this task.

Human chess review, manual accessibility evidence, S7 proxy/security headers,
abuse/load tests, structured-log redaction, retention and release recovery gates
remain open. A failed full gate blocks sprint completion and release certification.
