# Dependency and engine notices

Chess Tutor application source is licensed under GPL-3.0-or-later. See [LICENSE](LICENSE).
Dependency licenses remain with their respective authors. Lockfiles identify the
exact Python and JavaScript dependency graph; retain notices when distributing.

| Direct component | License | Upstream |
| --- | --- | --- |
| python-chess (`chess`) | GPL-3.0-or-later | https://github.com/niklasf/python-chess |
| Stockfish 19 | GPL-3.0 | https://github.com/official-stockfish/Stockfish/tree/sf_19 |
| Stockfish.js 17.1.0 (full WASM experiment) | GPL-3.0, Chess.com LLC / Stockfish contributors | https://github.com/nmrugg/stockfish.js/tree/v17.1.0 |
| FastAPI, Pydantic, Uvicorn | MIT / MIT / BSD-3-Clause | See locked package metadata |
| HTTPX | BSD-3-Clause | https://github.com/encode/httpx |
| SQLAlchemy, Alembic | MIT | https://github.com/sqlalchemy/sqlalchemy ; https://github.com/sqlalchemy/alembic |
| psycopg / psycopg-binary | LGPL-3.0 / LGPL-3.0 plus bundled library notices | https://www.psycopg.org/ |
| redis-py, RQ | MIT / BSD-2-Clause | https://github.com/redis/redis-py ; https://github.com/rq/rq |
| React, Vite, TypeScript | MIT | See locked package metadata |
| react-chessboard 5.12.1 | MIT, Ryan Gregory | https://github.com/Clariity/react-chessboard ; [retained license](docs/licenses/react-chessboard.txt) |
| Default chess piece artwork | CC BY-SA 3.0, Cburnett | https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces ; https://creativecommons.org/licenses/by-sa/3.0/ |
| PostgreSQL image | PostgreSQL License and bundled notices | https://www.postgresql.org/about/licence/ |
| Redis 7.2 image | BSD-3-Clause and bundled notices | https://github.com/redis/redis/tree/7.2.11 |

Stockfish archives and executable checksums are pinned in
[engines/stockfish.json](engines/stockfish.json). The selected official release
executables embed their NNUE data, covered by the executable checksum. Their
matching source is linked in that manifest. No engine binaries or model weights
are committed. The S3 engine-worker image installs the checksum-verified official
Linux x86-64 executable, its `Copying.txt` as `bin/stockfish-LICENSE.txt`, and exact
release/source/embedded-network provenance as `bin/stockfish-provenance.json`.
Native installation preserves the same sidecars. API images do not install the
engine. Retain these files and provide corresponding source for the exact build
when distributing; the manifest links the official release source and artifacts.

The browser experiment pins npm `stockfish@17.1.0` by package integrity plus
individual full-build JS/WASM checksums in
[the browser manifest](engines/stockfish-browser.json). Build preparation verifies
those checksums and copies both full single/threaded builds, the package's exact
GPLv3 license and provenance into ignored `public/engine` assets. A retained
[license copy](docs/licenses/stockfish-js.txt) and the exact modified source/build
tag are included in this branch. No lite engine is exposed or selected by the browser;
embedded network identities are recorded separately from native executable hashes.

The board uses the default SVG piece artwork repackaged by react-chessboard.
Its shapes match Cburnett's Wikimedia chess set (for example,
[the white pawn](https://commons.wikimedia.org/wiki/File:Chess_plt45.svg)); the
artwork is attributed under its CC BY-SA 3.0 option, independently of the
component's MIT license. Chess Tutor changes board colors and adds move outlines;
it does not edit the piece shapes. An attribution and license link accompany
the board. The new board dependency and its transitive dependencies are locked
in `apps/web/package-lock.json`; no second chess rules library is added.

This is a direct-dependency inventory, not a complete distributable
third-party notice bundle. Complete transitive/bundled notices and verify the
selected deployment distribution before public release in Sprint 7. No local
language model is selected or installed in Sprint 0.

The development-only security override pins `minimatch@11.0.1` (BlueOak-1.0.0,
[retained license](docs/licenses/minimatch.txt)) beneath
`@typescript-eslint/typescript-estree`. It adds
`@isaacs/nonrecursive-glob-match@1.0.3` (BlueOak-1.0.0); its
[retained license](docs/licenses/nonrecursive-glob-match.txt) accompanies the
locked package metadata. These lint dependencies are not frontend runtime code.

## Classic Merida chess pieces

`apps/web/public/pieces/classic/*.svg`: Armando Hernandez Marroquin,
GPL-2.0-or-later. Unmodified assets from lichess-org/lila public/piece/merida;
see that project's COPYING.md and the adjacent LICENSE.txt and README.md.
