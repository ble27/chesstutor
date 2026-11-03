# Dependency and engine notices

Chess Tutor application source is licensed under GPL-3.0-or-later. See [LICENSE](LICENSE).
Dependency licenses remain with their respective authors. Lockfiles identify the
exact Python and JavaScript dependency graph; retain notices when distributing.

| Direct component | License | Upstream |
| --- | --- | --- |
| python-chess (`chess`) | GPL-3.0-or-later | https://github.com/niklasf/python-chess |
| Stockfish 17.1 | GPL-3.0 | https://github.com/official-stockfish/Stockfish/tree/sf_17.1 |
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
are committed or bundled in the S0 application images. Engine installation and
execution are a Sprint 3 deliverable. A future redistributable engine package must
include its notices and corresponding source/build provenance, including the
network data needed for that exact build.

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
