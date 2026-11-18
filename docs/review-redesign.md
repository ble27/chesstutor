# Search and analysis redesign

Implementation baseline `94f27211f25b2c7cdbb38467b7761a0dae95c7ca`.
This extends the approved S6 review. Its original sprint baseline remains
`dd23c1c14d984f581a884444bf7c883d8414f4a1`. The attached images inform
module separation and notation scanning. Their controls and copy are reference
material.

## Incumbent audit

| Location | Removals and consolidation |
| --- | --- |
| App masthead, intro and footer | “Independent game review”, “Understand every move”, “Review public games, explore the alternatives, and learn at your own pace”, routine connected status, brand-positioning and affiliation footer sentence. |
| Discovery search | “Find your next game to learn from”, username instruction and redundant example, “Supported games and import limits” disclosure. |
| Library | “Recent games, ready for a closer look”, idle search/replay instructions, sorting/pagination/filter caption, routine archive/fetch metadata, repeated archive freshness, and explanatory part of ratings fallback. Flatten “More filters” and remove its second time-control selector. |
| Import and empty workspace | “Game imported” confirmation, repeated player/result/count summary, “Go to game review” link, validated-move/replay explanation, “Open a game from the library…” placeholder. Library rows also show the result twice, then repeat full-move and ply counts on reopening. |
| Replay board and footer | “Text position and FEN” disclosure, occupied-square explanation, repeated orientation, repeated preview context, keyboard instructions. Board credits remain available as source links. |
| Review shell | Analysis and Review tabs and hidden panels, browser experiment summaries for unavailable features, duplicate classification coverage and “Inspect ply” controls. The coach, analysis region, engine panel, review content and moves each impose independent or nested overflow. Library results also have their own scroll area. |
| Engine analysis and settings | Repeated best-line score and oversized position figure, per-candidate depth, prose for pending/limited evidence, provisional/cached/dispatch/partial messages, redundant progress treatment, “Review settings and limits” disclosure and “Settings” disclosure. Browser experiment has an eyebrow, explanatory paragraphs, and repeated progress. |
| Graph and summary | Selected graph score, ply and POV repeat the board evaluation and navigation. “How these numbers work”, formula and label prose, duplicate critical-moment labels and practice text. Keep calibrated accuracy and coverage as compact data. |
| Coach | “Your move coach”, repeated ply/color and classification heading, “Coach options and alternatives” disclosure, alternative narration duplicating engine recommendations, “Continuous text only”, local-voice instructions, pending/review instructions, repeated incompleteness and sandbox/variation explanation. Keep grounded lesson text, arrow toggle and failure recovery. |
| Local analysis | Combine duplicated local score/status, achieved depth and provenance where available. Preserve free play, refinement, branch and promotion actions. |

## Component map

```text
Library
  Chess Tutor
  [Chess.com username                       ] [Find games]
  Results when available
    [Player ratings]
    [Month] [Time control] [Color] [Opponent] [Apply filters]
    [Date / time control | Players | Result / moves | Analyze / source]

Desktop review
  [Back to library]   Game review                          [Result]
  ┌ Board ──────────────────────┐  ┌ Stockfish · depth · Settings ──┐
  │ Black player                │  │ Ranked lines / progress        │
  │ Eval rail | Board            │  ├ Evaluation history ───────────┤
  │ White player                │  ├ Coach · portrait / voice ─────┤
  │ Replay controls             │  │ Selected move note            │
  └──────────────────────────────┘  ├ Moves · White / Black ────────┤
                                    │ Paired rows · accuracy       │
                                    └───────────────────────────────┘
```

Warm board squares and brass selection sit on an ink-blue shell. The compact
score rail tracks the displayed position, including orientation changes. Settings
is a single dialog. At narrow or short sizes, modules stack and the page scrolls.

## Voice boundary

The browser sends the analysis ID and ply on Play. The API resolves the owned
analysis and renders its reviewed note without accepting client speech text.
The server uses ElevenLabs George with Multilingual v2, expressive stability,
and a slightly slower pace. Two concurrent syntheses, 40 starts per hour,
a 12-second deadline, 600 characters, a 256 KiB response and 24 cached clips
bound each API process. Shared multi-replica quotas require provider-side
limits. Only the move note is sent to the provider.

[ElevenLabs text-to-speech API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)
