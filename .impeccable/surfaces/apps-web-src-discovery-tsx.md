---
version: 1
slug: "apps-web-src-discovery-tsx"
primary_target: "apps/web/src/Discovery.tsx"
related_targets: ["apps/web/src/dashboard.css","apps/web/src/features/library","apps/web/src/features/replay/Replay.tsx"]
---

## Direction contract

Mode: Operate

**Thesis.** Take a player search directly to the game. Give each review task a
defined place in the same viewport.

**Visual world.** Black and charcoal surfaces, brass actions and focused states, tan and
cream Merida squares, an ivory knight portrait, and tabular scores.

**First viewport.** Open on the Chess.com username field and Find games action.
Results add ratings, visible filters and chronological rows. Review places the larger board and
persistent playback beside the Report, Self-analysis, and Analysis tabs.
Settings opens beside the tabs. Full notation and classifications live
in Report. The live branch uses the board as its move input.

**Interaction.** Analysis keeps the move commentary and engine evidence beside
the current position. Report follows page scroll with paired full moves.
Self-analysis shows up to two verified-legal local candidate lines.

**Sources.** See [DESIGN.md](../../DESIGN.md) and the
[redesign audit and component map](../../docs/review-redesign.md).
