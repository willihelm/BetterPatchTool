---
path: /Users/wilhelmduck/git/BetterPatchTool/src/components/project/patch-matrix.tsx
type: component
updated: 2026-01-21
status: active
---

# patch-matrix.tsx

## Purpose

Interactive patch matrix UI component for managing audio channel routing between inputs/outputs and stageboxes. Provides spreadsheet-like navigation, diagonal patching selection, stereo channel expansion, device filtering, and real-time collaboration via Convex mutations.

## Exports

- `PatchMatrix`: React component that renders the patching matrix interface with filtering, selection, and editing capabilities

## Dependencies

- react (hooks: useState, useRef, useCallback, useEffect, useMemo)
- convex/react (useQuery, useMutation)
- [[../../../convex/_generated/api]]
- [[../../../convex/_generated/dataModel]]
- [[../ui/button]]
- [[../ui/dropdown-menu]]
- [[../ui/badge]]
- [[../ui/input]]
- [[../../lib/utils]] (cn)
- lucide-react (Check, Filter, ChevronDown icons)
- [[./port-data-context]]

## Used By

TBD

## Notes

- Manages complex state: active/hovered cells, diagonal selection anchors, shift key tracking, editing mode
- Expands stereo channels into L/R rows for display when `true_stereo` mode enabled
- Implements spreadsheet-style navigation and batch patching via drag/shift-click
- Supports device filtering and unassigned channel filtering
- Uses portal rendering for dropdown menus