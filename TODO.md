# TODO - BetterPatchTool

Open tasks based on PRD requirements. Ordered roughly by priority.

## Authentication & Users

- [x] Implement user authentication (Convex Auth)
- [ ] Add login/signup flow (replace hardcoded `DEMO_USER_ID`)
- [ ] Implement pricing tier gating (Free / Pro / Team)

## Sharing & Collaboration

- [ ] Build invite/share UI for collaborators (link sharing)
- [ ] Add live cursors (show other users editing in real-time)
- [ ] Add user presence list (who is currently online)
- [ ] Add change history (who changed what, when)

## Import & Export

- [ ] CSV import with column mapping, preview, and validation
- [ ] CSV export (UTF-8 with BOM, separate files for inputs/outputs)

## Validation

- [ ] Build validation panel/summary UI
- [ ] Gap detection (non-sequential channel numbers)
- [ ] Missing required fields warnings (e.g. source without value)
- [ ] Unpatched channel warnings (port assigned but not marked patched)
- [ ] Orphan port detection (port occupied but no channel assigned)

## Input/Output Tables

- [ ] Channel grouping UI (create groups, assign channels, render group headers)
- [ ] Drag & drop row reordering (in addition to Alt+Arrow)
- [ ] Multi-cell copy/paste (full Ctrl+C/V support)
- [ ] Fill Down (Ctrl+D to apply value to selected cells)
- [ ] New row on Enter in last row
- [ ] Customizable columns (default set of columns + user-configurable additional columns)
- [ ] Customizable bus categories?

## Stagebox / IO Devices

- [ ] IO device templates (save/load reusable configurations)
- [ ] Zoom and pan for stagebox overview (large setups)

## Block Presets

- [ ] Share presets (team-wide or public sharing UI)
- [ ] Insert preset via `/` keyboard shortcut

## Comments

- [ ] Add comments/annotations on individual rows

## Responsive & Mobile

- [ ] Mobile view-only mode
- [ ] Add sharable QR-Code / Link for mobile view
- [ ] Tablet-optimized responsive layout
