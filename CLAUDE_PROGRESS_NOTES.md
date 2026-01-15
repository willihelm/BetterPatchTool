# Claude Progress Notes - BetterPatchTool

## Project Overview
BetterPatchTool is an audio patch planning application built with:
- Next.js 15, React 19, TypeScript
- Tailwind CSS with Radix UI components
- Convex for backend/database
- TanStack Table for data tables

---

## Session: 2026-01-15 (Latest)

### Features Implemented

#### 1. Alt+Enter - Copy and Increment from Cell Above

**Files Modified**:
- `src/components/project/input-channel-table.tsx`
- `src/components/project/output-channel-table.tsx`

**Feature**: Press Alt+Enter to copy the value from the cell directly above and increment any trailing number.

**Behavior**:
- "Vocal 1" → "Vocal 2"
- "CH10" → "CH11"
- "Mic" → "Mic" (no number, copies as-is)
- Saves immediately and jumps to the next row below
- Allows rapid filling by pressing Alt+Enter repeatedly

**Implementation**:
- Added `incrementTrailingNumber()` helper function using regex `/^(.*?)(\d+)$/`
- Added Alt+Enter handling in `handleTableKeyDown` switch case for Enter
- Calls `updateChannel()` directly and moves selection to next row

#### 2. Delete Key - Immediately Clear Cell

**Problem**: Delete key was calling `updateChannel()` with `undefined`, but the Convex mutation filters out undefined values:
```javascript
const filteredUpdates = Object.fromEntries(
  Object.entries(updates).filter(([_, v]) => v !== undefined)
);
```

**Solution**: Changed from `undefined` to empty string `""` which properly clears the field.

**Files Modified**:
- `src/components/project/input-channel-table.tsx`
- `src/components/project/output-channel-table.tsx`

#### 3. Arrow Keys While Editing - Save and Navigate

**Feature**: Pressing arrow keys while editing a cell now saves the current value and navigates to the adjacent cell.

**Implementation**: Added arrow key handling in the input element's `handleKeyDown`:
```javascript
} else if (e.key === "ArrowUp" || e.key === "ArrowDown" || ...) {
  e.preventDefault();
  saveEdit();
  stopEditing(true);
  // Navigate to new cell
  selectCell({ rowIndex: nextRowIndex, columnId: ... });
  containerRef.current?.focus();
}
```

#### 4. Bug Fix - Escape Key Navigation Issue

**Problem**: Pressing Escape set `activeCell` to `{ rowIndex: -1, columnId: "" }` instead of `null`. This caused keyboard navigation to break because:
- `if (!activeCell)` check failed (object is truthy)
- `initializeNavigation()` didn't reinitialize on focus
- Arrow keys used invalid rowIndex -1

**Solution**: Changed `selectCell({ rowIndex: -1, columnId: "" })` to `setActiveCell(null)`

### Code Changes Summary

**input-channel-table.tsx**:
- Added `incrementTrailingNumber()` function (lines 42-51)
- Modified Enter case in `handleTableKeyDown` to handle Alt+Enter (lines 236-257)
- Modified Delete/Backspace case to use `""` instead of `undefined` (lines 301-314)
- Added arrow key handling in input's `handleKeyDown` (lines 160-187)
- Fixed Escape to use `setActiveCell(null)` (lines 315-317)

**output-channel-table.tsx**:
- Same changes applied for consistency
- Added `setActiveCell` to hook destructuring (line 75)

### Keyboard Shortcut Reference

| Key | Mode | Action |
|-----|------|--------|
| Alt+Enter | Navigation | Copy from above, increment number, save, move down |
| Delete/Backspace | Navigation | Clear cell immediately |
| Arrow keys | Editing | Save and navigate to adjacent cell |
| Enter | Editing | Save and move to next row |
| Tab | Editing | Save and move to next column |
| Escape | Any | Deselect cell |
| F2 | Navigation | Start editing |

### Testing
All features verified with Playwright automated tests:
- Alt+Enter: CH1 → CH2 → CH3 → CH4 (rapid filling works)
- Delete: Clears cell value to "-"
- Arrow keys: Saves edits and navigates correctly

---

## Previous Session: 2026-01-15 (Earlier)

### 1. Fixed Tab Navigation Skipping Columns

**File**: `src/components/project/input-channel-table.tsx`

**Problem**: Tab key was being handled by multiple conflicting systems:
1. The `useKeyboardNavigation` hook added an event listener via `addEventListener`
2. The component had its own `onKeyDown={handleTableKeyDown}` on the same container
3. When Tab was pressed, focus escaped to native DOM elements (like the Patched checkbox)

**Solution**:
- Removed the `useKeyboardNavigation` hook entirely
- Replaced with local state management for `activeCell` and `isEditing`
- Added `containerRef.current?.focus()` after Tab/Enter/Escape to return focus to the container
- Added `e.stopPropagation()` to prevent event bubbling

### 2. Fixed First Letter Missing When Typing

**File**: `src/components/project/input-channel-table.tsx`

**Problem**: When a user selected a cell and started typing, the first character was lost.

**Solution**:
- Added `shouldSelectAll` state to control when text should be selected
- Modified the `useEffect` that handles input focus:
  - If `shouldSelectAll` is true: call `select()` (for click, Enter, F2)
  - If `shouldSelectAll` is false: move cursor to end (for typing)

---

## Files Structure

```
src/components/project/
├── input-channel-table.tsx   # Main input channels table with keyboard nav
├── output-channel-table.tsx  # Output channels table (similar implementation)
└── ...

src/components/table/hooks/
└── useKeyboardNavigation.ts  # Shared hook (not used by channel tables)

convex/
├── inputChannels.ts          # Input channel mutations
└── outputChannels.ts         # Output channel mutations
```
