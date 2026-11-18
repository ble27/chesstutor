---
name: Chess Tutor
description: A compact black and charcoal workbench for independent chess review.
colors:
  accent: "#e9c67d"
  accent-text: "#1e180e"
  accent-hover: "#f6e4aa"
  accent-active: "#d9b854"
  board-tan: "#B58B64"
  board-cream: "#F0D9B5"
  canvas: "#0b0b0b"
  panel: "#171717"
  inset: "#111111"
  line: "#343434"
  surface-raised: "#262626"
  surface-hover: "#373737"
  field-border: "#535353"
  text: "#f4f4f4"
  text-secondary: "#b6b6b6"
typography:
  review-title:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 650
  module-title:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
  control:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "14px"
  numeric-detail:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
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

The warm chessboard anchors a compact black and charcoal workbench. Distinct modules make
engine evidence, evaluation history, coaching, and paired notation easy to scan
alongside the position. Brass draws attention to the current move and primary
actions.

**Key Characteristics:**

- Tan and cream squares with locally served Merida pieces.
- Flat black and charcoal panels with restrained brass selection.
- Inter Variable with tabular scores and move numbers.
- A graph that also serves as the position scrubber.

## Colors

Brass marks selection, primary actions, and shared keyboard focus. Ice-white text
carries headings and actions, while muted gray identifies supporting data.
Use the inset ink tone for fields, plot backgrounds, and alternating move rows.
Keep the board squares warm tan and cream.

## Typography

Use self-hosted Inter Variable for labels, controls, and supporting text. The review
title drops to (16px) at widths up to (540px). Engine lines use (13px) at medium
weight (500), with brass score emphasis at (700). Use tabular numbers for scores,
progress through the game, accuracy, and paired move notation.

## Layout

The library centers a (680px) search panel in a shell capped at (1100px). Ratings
and a single filter bar sit above one divided list of games. The filter bar
switches to two columns below (1024px), and results follow the page scroll.

The review caps at (1280px) with a (1.23fr / 1fr) split and a (16px) gap.
The board and replay controls remain mounted across modes. Report contains the
complete paired move list and accuracy. Analysis contains the engine, evaluation
history, and coach. Self-analysis contains two locally searched alternatives
when available and the active branch. The page handles report scrolling. At
desktop sizes the board sticks within the review, and below (1024px) the
workspace stacks in a column capped at (700px).

## Elevation & Depth

One-pixel borders, inset surfaces, and alternating row tones separate adjacent
content. The Radix Settings dialog uses the same flat panel with a dark
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
playback controls use raised charcoal with a lighter hover fill. Label fields visibly
and preserve the shared (44px) minimum height for standard controls.

### Board and evaluation

Place player labels above and below the board and align them with its edge. The
rail displays the current position's score from White's perspective and flips
the fill with board orientation. An unavailable score displays a dash. The
(36px) rail narrows to (34px) at widths up to (540px). Preserve board coordinates
and the dark and gold inset marks on the last move's squares. [Merida piece attribution](apps/web/public/pieces/classic/README.md)

### Engine and settings

Keep Stockfish version and depth with ranked lines. Separate lines with thin
dividers and align their scores before the notation. Settings opens beside the workspace tabs in one modal with Standard and Thorough server review
options, local depth, and local threads.

### Evaluation history and moves

Overlay a keyboard-accessible range control on the (44px) graph. The selected
ply has a vertical gold marker, and gaps indicate missing evidence. Pair White
and Black SAN in full-move rows. Keep the selected move brass, display available
classifications as text, and distinguish Awaiting analysis from Review needed.

### Coach

The original ivory knight frames the selected move's note at (52px), shrinking
to (44px) at widths up to (540px). Keep Board arrows optional and pair them with
text descriptions. Play requests speech through the server's ElevenLabs
integration on demand, with device speech when the provider or media playback fails.
Highlight the important chess pieces and squares in the note. Keep it readable in loading, muted, and unavailable
voice states. [Coach avatar provenance](apps/web/public/coach/README.md)

## Do's and Don'ts

- Use brass for the current move, primary actions, and keyboard focus.
- Keep each game in a divided library row and each chess move in its color column.
- Use the evaluation graph itself for scrubbing and preserve visible replay controls.
- Keep the coach note primary and voice playback user-initiated.

Manual accessibility checks and live ElevenLabs audition are pending. The
redesign brief records the screenshot-led modular direction. [Redesign brief](docs/review-redesign.md)
