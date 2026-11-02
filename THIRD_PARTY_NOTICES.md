# Dependency and engine notices

Chess Tutor application source is licensed under GPL-3.0-or-later. See [LICENSE](LICENSE).
Dependency licenses remain with their respective authors. Lockfiles identify the
exact Python and JavaScript dependency graph; retain notices when distributing.

| Direct component | License | Upstream |
| --- | --- | --- |
| python-chess (`chess`) | GPL-3.0-or-later | https://github.com/niklasf/python-chess |
| Stockfish 17.1 | GPL-3.0 | https://github.com/official-stockfish/Stockfish/tree/sf_17.1 |
| FastAPI, Pydantic, Uvicorn | MIT / MIT / BSD-3-Clause | See locked package metadata |
| psycopg / psycopg-binary | LGPL-3.0 / LGPL-3.0 plus bundled library notices | https://www.psycopg.org/ |
| redis-py, RQ | MIT / BSD-2-Clause | https://github.com/redis/redis-py ; https://github.com/rq/rq |
| React, Vite, TypeScript | MIT | See locked package metadata |
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

This is a direct-dependency planning inventory, not a complete distributable
third-party notice bundle. Complete transitive/bundled notices and verify the
selected deployment distribution before public release in Sprint 7. No local
language model is selected or installed in Sprint 0.
