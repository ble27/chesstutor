# Chess Tutor

A planned free review tool for completed, public Chess.com games. Look up any
public username, replay both players' moves, choose a quick or deep Stockfish
review, and receive guidance grounded in the game.

This repository currently contains product and engineering documentation only.
Application code, dependencies, and runtime tests have not been implemented.

- [Product requirements and test-gated sprints](docs/PRD.md)
- [Verified integration research](docs/research.md)
- [Contributor and agent conventions](AGENTS.md)

The interface uses a restrained charcoal/gray gradient: board and move history
occupy two thirds of a wide screen, with engine results above chess coaching in
the remaining third. On small screens, these panels stack.

Analysis and move labels are independently computed; this project is not
affiliated with Chess.com and does not retrieve its paid Game Review output.
Public data can include optional provider accuracy values; those are not used
as this product's analysis.

Implementation starts only when requested. During implementation, each sprint
must pass its documented gates before the next sprint begins. Use Conventional
Commits for small, coherent changes and retain regression tests for fixes.
