# Review modes

Implementation baseline `4184046313ea9eb2a65dfe1572d771bc7b48496d`.
The S6 comparison remains `dd23c1c14d984f581a884444bf7c883d8414f4a1`.

The user requested three workspace modes. Analysis keeps the recorded board,
engine lines and selected coach note. Report owns the full paired move list.
Self-analysis starts a local branch at the selected recorded position and plays
on the board. The neutral black shell preserves warm pieces and brass focus.
Move labels report the available evidence. Pending and inconclusive engine
results receive explicit statuses rather than invented move grades.

## Interaction and evidence

- Radix Tabs use manual keyboard activation. Arrow keys move between tabs.
  Enter or Space switches the view. Replay keys remain scoped to the board
  workspace and yield to tabs, dialogs, selects, and the self-analysis board.
- Self-analysis requests Stockfish MultiPV 2. Both candidates must be legal,
  have distinct first moves, and share a completed depth. A single candidate
  remains valid when the search only returns one usable line. Browser output
  stays separate from server move grades.
- Coach tries the existing ElevenLabs route before device speech. The server
  key is absent in the local environment used for verification. Device speech
  depends on the browser and operating system voice availability.
- Inter is served from the pinned Fontsource package. Radix Tabs, Select,
  Dialog, and Checkbox follow the shadcn composition with the app's CSS.
  [Component reference](https://ui.shadcn.com/docs/components/radix/tabs)
- Merida attribution remains in the distributed piece assets and notices.
  [Piece attribution](../apps/web/public/pieces/classic/README.md)
