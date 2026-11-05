# Unified chess review workspace — implementation plan

Status: locally implemented; verification and open gates are recorded in docs/sprints/S4.md. Preserve existing board colors; use a 60/40 desktop split. Engine values must come from validated engine evidence only.
Implementation starting point: `198f997f297c1916cc7c5fcfab3c6dd2d3afbf6e`
on `design/unified-review`. The implementation baseline is this commit. Preserve the original checkout's pending S4 work.

## Target and reference critique

The user request of 2026-11-05 supplies the updated UI requirements. The brown
board reference is the primary composition reference; the green board reference
demonstrates dense analysis and game review. Keep Chess Tutor's charcoal/gray
application surfaces, existing teal/cream squares, and existing licensed pieces. Reference
screenshots supply layout guidance, not proprietary scores or product claims.

| Aspect | Reference | Current implementation | Required correction |
| --- | --- | --- | --- |
| Board | Square fills almost all available vertical space; narrow player rows | Large outer card, heading, prose and generous padding; 640px cap and height subtraction leave board small | Fit the board to available workspace height and width; remove competing card padding and replay heading |
| Right workspace | One continuous frame aligned with the board/player frame | One outer frame, but analysis contains summaries and guidance remains another card | One tabbed frame; Analysis, Review and Chess guidance |
| Analysis | Compact score plus legal candidate lines above recorded moves | Paragraph-heavy job/evidence/summary stack in a capped scrolling area | Reserve an upper region for the displayed position's score and candidate lines; move game summary to Review |
| Recorded moves | Compact paired White/Black notation inside Analysis | Separate “Game moves” heading and help paragraph | Remove visible heading; retain an accessible move-list label; compact paired rows in the lower region |
| Navigation | Persistent bottom toolbar within the right frame | Large buttons under the board | Put first/previous/next/last and flip inside the right frame's persistent footer |
| Viewport | Board and right workspace read as one work surface | Unequal panels and large surrounding whitespace | Align frame tops/bottoms; scroll content within the right workspace while board stays anchored |

## Layout and interaction contract

```text
Desktop: board 60%                       Right workspace 40%
┌──────────────────────────────────────┬──────────────────────────┐
│ Black player                         │ Analysis | Review | Guide │
│                                      ├──────────────────────────┤
│                                      │ Actual score + legal PVs │
│       SQUARE CHESS BOARD             │                          │
│       existing teal/cream colors     ├──────────────────────────┤
│                                      │ White / Black moves      │
│                                      │                          │
│ White player                         ├──────────────────────────┤
│                                      │ Navigation · Flip        │
└──────────────────────────────────────┴──────────────────────────┘
```

The third tab's full label is **Chess guidance**; it remains a future-feature
placeholder. The diagram abbreviates that tab only to fit the schematic.


- Desktop: keep board on the left, sticky within the workspace once reached.
  Use a square sized from available viewport height minus compact player rows,
  and the available left column width. Replace the unconditional 640px maximum
  and `100dvh - 360px` formula. Target roughly 60% of the occupied workspace
  for the board side, allowing the right frame a readable minimum width.
- Center the combined workspace rather than centering a small board inside a
  much larger card. At 1440×900, target a board of about 680–740 CSS px once the
  workspace is reached; at 1024×768, shrink to fit without clipping. These are
  proposed acceptance targets to validate in the render, not measured results.
- The right frame height matches board plus player rows. Use grid rows for tab
  strip, flexible content, and persistent footer. In Analysis, use separate
  bounded regions for evidence and moves; long lines must not push the move
  list or navigation off the frame. Use `min-height: 0` on scrollable grid areas.
- Review shows per-color classification counts, mistakes, blunders, coverage,
  and supported critical moments. Selecting a critical moment selects its ply
  and opens Analysis. Do not invent Chess.com accuracy or unsupported badges.
- Chess guidance is a selectable tab with an explicit “Not available yet” state.
  It does not implement coaching or issue coach requests.
- Keep navigation mounted inside the same right frame across tabs. Tab changes
  preserve selected ply, orientation, job state and polling. At endpoints,
  disable unavailable controls. No autoplay is included in this scope.
- On narrow/tablet screens where readable columns no longer fit, place the
  board above the same tabbed frame. Keep navigation inside that frame; retain
  at least 44px touch targets. Never use horizontal page scrolling or crop the
  board. At 200% zoom, allow the same reflow.
- Keep FEN/text-position access and piece credits available through compact
  disclosure content. A game opening should scroll the real workspace into
  view once, without pulling it away again during polling or navigation.

## Evaluation and selected-ply correctness

Use one `selectedPly` for board FEN, selected recorded move, engine view and
navigation. Forward/backward means one half-move, including Black moves.
White's score POV stays fixed when the board flips. Mate is a separate score
state, not converted to a centipawn number. Display pawn-unit evaluations as
White evaluation, not expected-score loss or “accuracy.”

The existing API stores evidence for move `k` at root position `k - 1`.
Implement a typed, pure position-view selector before changing the renderer:

1. For displayed position `s`, find evidence whose `before_ply === s` and whose
   `root_fen` matches `game.positions[s].fen`. Its unrestricted best score and
   legal PVs describe the displayed board. At the initial position, this comes
   from evidence for move 1.
2. If that root evidence is missing, evidence for move `s` can supply its
   restricted played-line evaluation. Label it “Evaluation after [SAN]”; do
   not present its pre-move candidate lines as moves from the displayed board.
3. At the final recorded position, there is no following pre-move record.
   Show the last played-line evaluation with that explicit label and no
   invented current-position candidates. Terminal-result text comes from the
   validated game/evidence. A new final-position search would be separate
   backend scope, not a silent UI assumption.
4. Missing evidence renders pending/unavailable for this position immediately.
   Never retain the previously selected position's score. Mark unstable or
   insufficient evidence explicitly. Preserve partial results after cancel or
   failure and preserve the selected ply when new evidence arrives.

Classification for the selected recorded move still uses `ply === s`; it is
distinct from next-position candidate evidence. No extra analysis request is
issued merely by navigating or switching tabs.

## Implementation sequence

1. Record the implementation baseline in sprint/task evidence before editing.
   Update PRD §4 with this explicitly requested replacement of separate panels,
   navigation location, board cap and desktop proportions. Keep all other
   product/chess requirements. This task does not mark S4 or S6 complete.
2. Write failing regression tests for selected-position evidence, shared
   navigation and tabs. Use legal fixtures with several distinct scores for
   consecutive White and Black plies, plus mate and incomplete evidence.
3. Keep `useReplay` as replay state owner. Lift `useAnalysis` from the disposable
   Analysis tab into a per-game session owner; pass typed state/actions to
   views. Switching tabs must not unmount or restart the engine lifecycle.
4. Extract a focused right-frame component (`ReviewWorkspace`) and persistent
   navigation toolbar. Extract the pure position-view selector. Components may
   remain modular in source; visually they form one right-hand component.
5. Refactor `EnginePanel`/`EngineEvidence` into compact analysis status/actions
   and position score/PV presentation. Split selected-move classification from
   `ClassificationSummary`; put the summary in the Review tab. Reuse the
   existing validated API and engine hooks.
6. Move `MoveList` into Analysis beneath evidence, remove its visible title,
   and move navigation from the board to the right-frame footer. Keep both
   players' moves, starting full-move numbers and Black-to-move setups correct.
7. Implement board-fit geometry, compact player rows, common frame height,
   desktop anchoring and responsive reflow in `styles.css`. Apply the same
   shell to the opt-in browser engine while keeping its trust labels and
   analysis actions explicit; do not treat it as trusted server evidence.
8. Compare actual rendered states against the references, fix discrepancies,
   rerun affected checks, and capture again. Build/restart the actual frontend
   from the verified branch only after checks; verify branch source in the
   served container. Use the actual app entry point, not a separate preview.
9. Review the entire diff from the recorded baseline, including new files,
   against AGENTS.md, PRD and this acceptance contract. Resolve findings, then
   commit coherent behavior with tests and evidence using explicit paths.

Primary files: `Replay.tsx`, `useReplay.ts`, `MoveList.tsx`, `BoardFrame.tsx`,
`EnginePanel.tsx`, `EngineEvidence.tsx`, `ClassificationPanel.tsx`,
`ClassificationSummary.tsx`, `InsightPanels.tsx`, and `styles.css` under
`apps/web/src`. Add small focused components/selectors as needed; no dependency
or API-schema change is expected for the behavior described above.

## Verification and iteration gates

### Deterministic tests

- Forward/backward and direct SAN selection update FEN, score, candidates and
  selection together for both colors; cover initial/final positions and mate.
- Pending evidence clears stale scores; partial jobs stay partial; new polls
  and tab changes preserve selection and do not duplicate requests.
- Flipping swaps board/player edges without changing selection or White POV.
- Analysis contains paired moves and navigation; no visible “Game moves”
  heading or navigation beneath the board. Review content appears in Review;
  guidance placeholder appears in its tab. Critical moments select a real ply.
- Arrow/Home/End navigation does not intercept typing or tablist keys. Implement
  tablist Arrow/Home/End behavior with correct tab/tabpanel associations and
  roving focus; prevent those handled keys from bubbling to replay navigation.

### Browser and visual evidence

- Test 320×740, 390×844, 768×1024, 1024×768, 1440×900, 1920×1080 and 2560×1440,
  plus a short 1920×600 viewport and 200% zoom.
- Assert board squareness, increased desktop size, board/frame alignment,
  persistent footer visibility, analysis-before-moves order and no page overflow.
- Test a long game, long player names/PVs, active/complete/cancelled/failed jobs,
  and tabs with empty or incomplete summaries.
- Capture workspace crops at fixed viewport sizes with real engine evidence.
  Compare to the reference by proportions, content density,
  navigation placement and board dominance. Also inspect mobile captures.
- Repeat capture → compare → fix until the required topology and fit match.
  Passing DOM assertions alone does not establish visual similarity. Record
  each material discrepancy and its disposition; retain unresolved ones openly.
- Verify the actual running application with public lookup → import → Quick
  → several forward/backward steps → Review → Analysis → flip. State clearly
  whether engine evidence was newly computed or reused from cache.
- Run manual keyboard/focus, contrast, zoom and screen-reader checks. Do not
  claim these passed based on screenshots or automated accessibility checks.

Run `make check`, the affected unit/browser suites, `make build`, and
`make verify`. Current baseline has known future-sprint Python failures (last
recorded full run: 109 failed, 251 passed); verify and record current results
without suppressing them. A failed full gate prevents sprint completion, even
when this UI change's focused checks pass. `/diff` and `/review` are unavailable
here, so record equivalent complete Git diff and code-review evidence.

## Acceptance checklist

- [ ] Large board in the existing colors stays on the left at desktop sizes.
- [ ] Exactly one right frame contains Analysis, Review and Chess guidance tabs.
- [ ] Analysis shows current-position evidence above both players' recorded moves.
- [ ] First/previous/next/last and flip are inside that frame's persistent footer.
- [ ] Navigation synchronizes board, score and move selection at every available ply.
- [ ] Review contains real summaries; guidance remains an honest future state.
- [ ] Visible “Game moves” heading and separate guidance card are removed.
- [ ] Reference comparison and responsive/manual accessibility evidence are recorded.
- [ ] Actual app is built from the reviewed branch and verified; commits and any
  unresolved full-gate failures are documented before handoff.
