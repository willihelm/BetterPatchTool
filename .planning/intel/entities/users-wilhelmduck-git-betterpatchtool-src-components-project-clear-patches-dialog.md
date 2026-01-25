---
path: /Users/wilhelmduck/git/BetterPatchTool/src/components/project/clear-patches-dialog.tsx
type: component
updated: 2026-01-21
status: active
---

# clear-patches-dialog.tsx

## Purpose

Dialog component that prompts users to confirm clearing all patches for input or output channels. Implements a safety mechanism requiring text confirmation ("CLEAR") before destructive action.

## Exports

- `ClearPatchesDialog`: React component accepting open state, channel type/count, and confirmation callback

## Dependencies

- react
- @/components/ui/button
- @/components/ui/dialog
- @/components/ui/input
- @/components/ui/label

## Used By

TBD

## Notes

Case-insensitive text matching for confirmation (requires "clear" in any case). Clears confirmation text on dialog close to prevent accidental re-submission. Loading state prevents multiple submissions during async operation.