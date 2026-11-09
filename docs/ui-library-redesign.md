# Search and game library redesign

Fixed baseline: `a758408d16a2fd6e54dae5179c6a93c501813d7c`.
Branch: `design/approachable-game-library`.

This is a frontend presentation change, not a new sprint or a change to engine,
classification, coaching, or transport policy. Existing pending work is preserved.

## Direction

Operate mode. A quiet charcoal surface, one sans-serif type scale, generous
section spacing, and a single chronological game list with compact summaries.
Preserve the teal/cream board, desktop 60/40 board/review split, tab semantics,
actual engine values, replay controls, errors, pagination, and import validation.
Use open-source time-control icons with attribution. Keep search, archive month,
and advanced filters keyboard accessible. Ratings use the public stats endpoint (rapid/blitz/bullet) without dates, per
the user’s clarification; missing ratings stay unrated/unavailable. Move counts
come from bounded PGN validation of each displayed game, not guessed metadata.
The API changes are additive and reuse existing cache, limiter, and URL checks.

## Verification

Tests cover canonical result presentation, current rating provenance, filters,
missing/legacy metadata, validated move counts, import flow, and responsive layouts.
Desktop/mobile captures were inspected, with independent standards/spec and
Impeccable finish reviews. Commands, results, and remaining full-suite/manual
limits are recorded in `docs/sprints/S4.md`. The live local preview is at
`http://127.0.0.1:5173`; search a public username, choose a time control or month,
and open a game. Its board and review workspace receive focus automatically.
