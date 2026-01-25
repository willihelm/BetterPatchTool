---
path: /Users/wilhelmduck/git/BetterPatchTool/src/components/project/patch-matrix.tsx
type: component
updated: 2026-01-21
status: active
---

# patch-matrix.tsx

## Purpose

Interactive matrix component for creating and managing audio patch connections between input/output channels and IO ports. Implements spreadsheet-like keyboard navigation, diagonal patching, device filtering, and real-time stereo channel management.

## Exports

- **PatchMatrix**: React component that renders an interactive patch matrix UI with toggle between input/output channels, device filtering, cell navigation, and batch diagonal patching operations.

## Dependencies

- [[port-data-context]]: usePortData hook providing input/output port groups
- [[clear-patches-dialog]]: ClearPatchesDialog component for bulk patch clearing
- [[clear-device-patches-dialog]]: ClearDevicePatchesDialog component for device-specific patch clearing
- React hooks (useState, useRef, useCallback, useEffect, useMemo)
- convex/react: useQuery, useMutation for real-time database operations
- @/components/ui/{button, dropdown-menu, badge, input}: shadcn/ui components
- @/lib/utils: cn utility for className merging
- lucide-react: Check, Filter, ChevronDown, Trash2, X icons

## Used By

TBD

## Notes

Complex state management for multi-cell interactions including diagonal anchor tracking, Shift+Click diagonal patching, device selection persistence across data updates, and stereo channel L/R row expansion. Matrix cells implement crosshair highlighting and visual feedback for assigned/used/available port states.