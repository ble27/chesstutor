---
name: Chess Tutor
description: A compact ink-blue workbench for independent chess review.
colors:
  accent: "#e9c67d"
  accent-text: "#1e180e"
  accent-hover: "#f6e4aa"
  accent-active: "#d9b854"
  board-tan: "#B58B64"
  board-cream: "#F0D9B5"
  canvas: "#111720"
  panel: "#1a2330"
  inset: "#151d28"
  line: "#354354"
  surface-raised: "#263345"
  surface-hover: "#35475d"
  field-border: "#536579"
  text: "#f3f4f5"
  text-secondary: "#b6c1cf"
typography:
  review-title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 650
  module-title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
  control:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
  numeric-detail:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
rounded:
  board: "4px"
  rail: "6px"
  control: "8px"
  panel: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-text}"
    rounded: "{rounded.control}"
    padding: "10px 22px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-primary-active:
    backgroundColor: "{colors.accent-active}"
  button-secondary:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-hover}"
  input:
    backgroundColor: "{colors.inset}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
    padding: "12px"
  move-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-text}"
    rounded: "{rounded.control}"
  settings-dialog:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "20px"
---

# Design System: Chess Tutor

## Overview

**Creative North Star: "The Chess Review Workbench"**

The warm chessboard anchors a compact ink-blue workbench. Distinct modules make
engine evidence, evaluation history, coaching, and paired notation easy to scan
alongside the position. Brass draws attention to the current move and primary
actions.

**Key Characteristics:**

- Tan and cream squares with locally served Merida pieces.
- Flat ink-blue panels with restrained brass selection.
- One system sans stack with tabular scores and move numbers.
- A graph that also serves as the position scrubber.

## Colors

Brass marks selection, primary actions, and shared keyboard focus. Ice-white text
carries headings and actions, while muted blue-gray identifies supporting data.
Use the inset ink tone for fields, plot backgrounds, and alternating move rows.
Keep the board squares warm tan and cream.

## Typography

Use the system sans stack for labels, controls, and supporting text. The review
title drops to (16px) at widths up to (540px). Engine lines use (13px) at medium
weight (500), with brass score emphasis at (700). Use tabular numbers for scores,
progress through the game, accuracy, and paired move notation.

## Layout

The library centers a (680px) search panel in a shell capped at (1100px). Ratings
and a single filter bar sit above one divided list of games. The filter bar
switches to two columns below (1024px), and results follow the page scroll.

The review caps at (1280px) with a (1.12fr / 1fr) split and a (16px) gap. The
board and its replay controls occupy the left column. Engine, Evaluation history,
Coach, and Moves appear in that order on the right, with (12px) gaps. At widths
from (1024px) and heights from (740px), the right column fits the viewport and
the paired move list is its single scroll region during ordinary game review.
Short desktop windows and free analysis use page scrolling. Below (1024px), the
board and modules stack in a column capped at (700px) and share the page scroll.

## Elevation & Depth

One-pixel borders, inset surfaces, and alternating row tones separate adjacent
content. The native Settings dialog uses the same flat panel with a dark
backdrop. Preserve the shared (2px) focus outline and keep it visible on the
graph. Shared button color transitions run for (150ms) with ease-out and stop
under reduced motion. Board moves render without animation.

## Shapes

Use the panel radius for modules and Settings, the control radius for buttons,
fields, and the square coach portrait, and the tighter radii for the rail and
board. Player dots accompany visible or accessible color names.

## Components

### Buttons and fields

Find games uses brass with dark text. Navigation, replay, Settings, and coach
playback controls use raised ink with a lighter hover fill. Label fields visibly
and preserve the shared (44px) minimum height for standard controls.

### Board and evaluation

Place player labels above and below the board and align them with its edge. The
rail displays the current position's score from White's perspective and flips
the fill with board orientation. An unavailable score displays a dash. The
(36px) rail narrows to (28px) at widths up to (540px). Preserve board coordinates
and the dark and gold inset marks on the last move's squares. [Merida piece attribution](apps/web/public/pieces/classic/README.md)

### Engine and settings

Keep Stockfish version and depth with ranked lines. Separate lines with thin
dividers and align their scores before the notation. Settings opens from the
Engine module in one native modal with Standard and Thorough server review
options, local depth, and local threads.

### Evaluation history and moves

Overlay a keyboard-accessible range control on the (44px) graph. The selected
ply has a vertical gold marker, and gaps indicate missing evidence. Pair White
and Black SAN in full-move rows. Keep the selected move brass, display available
classifications as text, and distinguish Pending from Unclassified.

### Coach

The original ivory knight frames the selected move's note at (52px), shrinking
to (44px) at widths up to (540px). Keep Board arrows optional and pair them with
text descriptions. Play requests speech through the server's ElevenLabs
integration on demand. Keep the note readable in loading, muted, and unavailable
voice states. [Coach avatar provenance](apps/web/public/coach/README.md)

## Do's and Don'ts

- Use brass for the current move, primary actions, and keyboard focus.
- Keep each game in a divided library row and each chess move in its color column.
- Use the evaluation graph itself for scrubbing and preserve visible replay controls.
- Keep the coach note primary and voice playback user-initiated.

Manual accessibility checks and live ElevenLabs audition are pending. The
redesign brief records the screenshot-led modular direction. [Redesign brief](docs/review-redesign.md)
