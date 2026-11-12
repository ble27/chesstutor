---
name: Chess Tutor
description: A quiet charcoal workspace for independent chess review.
colors:
  accent: "#eac96a"
  accent-hover: "#f6e4aa"
  accent-active: "#d9b854"
  board-teal: "#637878"
  board-cream: "#e0dfd5"
  arrow-played: "#49160e"
  arrow-suggested: "#31e65c"
  arrow-outline: "#092e20"
  canvas: "#181818"
  canvas-end: "#242424"
  panel: "#242626"
  surface-raised: "#2b3030"
  field: "#1d2020"
  action-secondary: "#363e3e"
  selected: "#3b4544"
  opened: "#2d3836"
  text: "#eeeeee"
  heading: "#f1f3f2"
  text-secondary: "#b9c1c1"
  text-muted: "#b8b8b8"
  line: "#414747"
  panel-border: "#3b3b3b"
  field-border: "#596262"
  action-border: "#63716e"
typography:
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 500
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 500
    letterSpacing: "-0.02em"
  section:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
  caption:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
  rating:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
rounded:
  board: "4px"
  control: "8px"
  panel: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  control-gap: "12px"
  md: "16px"
  compact-panel: "20px"
  lg: "24px"
  xl: "32px"
  page: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.control}"
    padding: "10px 22px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-primary-active:
    backgroundColor: "{colors.accent-active}"
  button-secondary:
    backgroundColor: "{colors.action-secondary}"
    textColor: "{colors.heading}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  filter-selected:
    backgroundColor: "{colors.selected}"
    rounded: "{rounded.control}"
  panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
---

# Design System: Chess Tutor

## Overview

**Creative North Star: "The Quiet Review Workspace"**

Chess Tutor uses the approved quiet charcoal Operate direction: a practical tool
whose visual emphasis belongs to the chess position and the next useful action.
The existing teal and cream board remains the recognizable center of the review.

Flat bordered surfaces, one sans family, and compact explanatory text support
careful reading. Gold connects actions, keyboard focus, and the current move.
This records the implemented interface, not release or accessibility gate status.

**Key Characteristics:**

- Charcoal surfaces with quiet dividers.
- Teal and cream chessboard with gold move emphasis.
- Consistent sans typography and tabular chess numbers.
- Flat controls with visible keyboard focus.

## Colors

### Primary

**Warm Gold** is the action and selection accent. Its lighter and deeper states
provide feedback on primary controls; focus outlines use the same accent.

### Secondary

**Board Teal** and **Board Cream** belong to chess squares. Muted green charcoal
surfaces identify filters, secondary actions, and the opened game without competing
with the board.

### Neutral

**Charcoal Canvas** grades subtly toward its lighter endpoint. **Panel Charcoal**
sits above it through a border rather than a shadow. Bright text, softer headings,
and muted secondary text create hierarchy; line and field colors separate content
and controls. Both secondary-text shades are present in the incumbent cascade.

**The Board Identity Rule.** Preserve teal and cream squares; use gold to identify
selected moves and actions rather than recoloring the board.

## Typography

One shared family stack serves headings, prose, and controls. Inter is named in
CSS but is not bundled or downloaded; the available system sans renders when
Inter is absent. Do not claim a guaranteed Inter rendering. FEN uses the platform
monospace stack as a functional exception.

The frontmatter records the observed headline, title, section, body, label,
caption, and rating roles. On narrow screens the page headline becomes (28px).
Analysis prose commonly uses (13px) with (1.5) line height; secondary detail can
reach (11px). Body paragraphs use the body line height, while controls retain
native line-height behavior. Ratings, scores, and move columns use tabular numerals.
Supporting prose is constrained to (65–72ch) where the layout permits it.

**The One Voice Rule.** Use the shared sans stack for interface text and reserve
monospace for literal position notation.

## Layout

The application container is centered at a maximum width of (1440px), with (40px)
side padding, reduced to (16px) at widths of (767px) and below. The masthead has a
minimum height of (72px). Main surface gaps use the established spacing scale.

At desktop widths of (1024px) and above, the replay workspace uses a (3fr / 2fr)
board-to-analysis split with a (24px) gap. Board sizing also respects viewport
height; its panel is sticky at (12px). Below that breakpoint, board and analysis
stack and the board is capped at (640px). The analysis panel has its own bounded
scroll areas and a (740px) stacked height.

The search surface has two desktop columns and stacks below (1024px). Library
rows form one divided chronological list, adapting from four columns to three,
then to a two-column arrangement at (600px) and below. The list scrolls within
(480px), expanded to (600px) on narrow screens. Ratings remain a compact three-item
strip; current ratings have no date annotations. Games retain their timestamps.

## Elevation & Depth

The interface is flat. Surface tones, one-pixel borders, and dividers supply depth;
there are no ambient panel shadows. Inset shadows indicate the selected analysis
tab and the last move's board squares. Gold focus outlines are (2px), normally
with a (3px) offset. Buttons transition background and border colors over (150ms)
with ease-out; reduced-motion preferences remove those transitions. Board
animations are disabled.

**The Flat Surface Rule.** Use borders and tone to separate tool surfaces; reserve
inset emphasis for selected state.

## Shapes

Panels use softly curved corners; controls are slightly tighter, and the board
uses the smallest radius. The token frontmatter owns these values. Tabs and move
rows remain flush with their container. Circular white and black markers convey
player color alongside explicit text labels, not as the only indicator.

## Components

### Buttons

Primary search and first analysis actions use gold with charcoal text. Secondary
row actions use a green charcoal fill and subdued border. Shared controls have a
minimum height of (44px); disabled buttons retain layout and use (0.55) opacity.
Hover and active states use the observed accent variants where not overridden by
a quieter component-specific treatment.

### Inputs / Fields

Fields use a dark inset tone, a visible one-pixel stroke, curved control corners,
and explicit labels. Hover lightens the stroke. Keyboard focus uses the shared
gold outline. Search remains full-width on narrow screens.

### Chips

Time-control filters are actual buttons with pressed state, not decorative tags.
Selection uses the muted green charcoal tone and a stronger border. Locally served
Lucide SVGs pair with rapid, blitz, and bullet text; daily remains text-only.

### Cards / Containers

The search and game library share panel material. The library uses internal
sections and dividers rather than separate cards for every game. Padding varies
with context and viewport, using the recorded spacing scale.

### Navigation

Analysis, review, and chess guidance use adjacent flat tabs with a gold inset
underline for the selected tab. Replay navigation is a compact footer grid.
At narrow widths its final flip-board action spans the full row. Tab and button
labels remain visible text.

### Chessboard and move list

The read-only board preserves teal and cream squares. Last-move squares receive a
charcoal-and-gold inset outline. The selected move receives a gold background,
dark text, and stronger weight. Legal-position text, player descriptions, and
attributed Cburnett pieces accompany the visual board. Piece provenance is
CC BY-SA 3.0; local Lucide icons retain the accompanying ISC/MIT notices.

### Chess guidance

Guidance uses the existing panel hierarchy and scroll area. Showing a lesson's
arrows previews its pre-move position, labelled "Before" in the replay status;
hiding them restores the selected post-move position. Position text follows the
displayed board. Played moves use opaque dark red arrows, suggestions opaque
bright green with a hard dark outline, with each move also named in a text list.
The outline exceeds 3:1 against either board square color. Suggested-move labels use matching engine
scores with explicit score perspective and separate mate notation; unavailable
scores are identified in words. These details do not certify the outstanding
manual screen-reader gate recorded in S5.md.

Review summaries use a flat comparison table: move labels on the left, named
White/Black columns on the right. A single primary label counts each reviewed
ply once, including zero-count rows. Accuracy, scored coverage and expected-score
loss remain together; a disclosure defines the independent accuracy formula.
Numeric percentages stay on one line at phone widths. In Chess guidance, each
selected analyzed ply has a reviewed label explanation; the replay footer cycles
through plies. The move list shows primary labels and distinguishes Pending from
Unclassified. None of these additions closes the manual accessibility gate.

## Do's and Don'ts

### Do:

- **Do** preserve the teal and cream board with gold move emphasis.
- **Do** use the shared sans family stack and tabular numbers for chess data.
- **Do** keep controls at least 44px high and show a visible keyboard focus state.
- **Do** use local SVG icons with their text labels and retain asset licenses.
- **Do** preserve the desktop 60/40 review split and stack it below 1024px.

### Don't:

- **Don't** introduce decorative glyph icons or a competing display typeface.
- **Don't** turn individual library games into a grid of cards.
- **Don't** add ambient card shadows to the flat charcoal surfaces.
- **Don't** treat the named Inter family as an installed font guarantee.

Not canonized: unused legacy eyebrow and oversized workspace-mark CSS do not
establish reusable patterns. PRODUCT.md still describes a 2:1 desktop workspace
and planned coaching; those pre-existing descriptions need a separate product
consistency review. This document does not repair them or certify pending gates.

Extraction sources: `apps/web/src/styles.css`, `library.css`, `App.tsx`,
`Discovery.tsx`, `features/library/`, and `features/replay/Board.tsx`; visual
cross-checks: `.impeccable/review/library-1440.png` and `workspace-390.png`.
