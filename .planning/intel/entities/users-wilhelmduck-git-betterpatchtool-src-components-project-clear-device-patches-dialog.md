---
path: /Users/wilhelmduck/git/BetterPatchTool/src/components/project/clear-device-patches-dialog.tsx
type: component
updated: 2026-01-21
status: active
---

# clear-device-patches-dialog.tsx

## Purpose

Provides a confirmation dialog for clearing all patches associated with a specific device (stagebox). Displays the device name, color, and affected channel count before the user confirms the destructive operation.

## Exports

- `ClearDevicePatchesDialog`: React component that renders a modal dialog with cancel and confirm buttons for clearing device patches

## Dependencies

react, @/components/ui/button, @/components/ui/dialog

## Used By

TBD

## Notes

Manages loading state (`isClearing`) during the async clear operation to prevent multiple submissions. Uses color swatch visualization to match the device in the UI. Pluralizes channel count in the confirmation message.