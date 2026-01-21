# Codebase Concerns

**Analysis Date:** 2026-01-21

## Security & Authorization

**Missing Access Control:**
- Issue: No authorization checks in any Convex mutations or queries. Any authenticated user can read, modify, or duplicate any project.
- Files: `convex/projects.ts`, `convex/inputChannels.ts`, `convex/outputChannels.ts`, `convex/ioDevices.ts`, `convex/patching.ts`
- Current state: `ownerId` and `collaborators` are stored but never validated. For example, `projects.duplicate()` accepts `ownerId` as a parameter without validating if the caller is allowed to duplicate.
- Impact: Users can access, modify, or delete other users' projects. Collaborators array is never enforced.
- Fix approach: Add identity checks using Convex `ctx.auth`. Validate that the caller is either the project owner or in the collaborators list before allowing mutations.

**Unprotected Project Deletion & Archiving:**
- Issue: Archive and delete operations lack any ownership validation
- Files: `convex/projects.ts` (lines 99-104)
- Impact: Any user can archive any project
- Fix approach: Validate `ctx.auth.getUserIdentity()` matches project owner or collaborator status before patching

## Type Safety Issues

**Unsafe Type Assertions in Project Duplication:**
- Issue: Multiple `as any` casts when duplicating projects, mapping IDs from Maps
- Files: `convex/projects.ts` (lines 170, 203-206, 221-222)
- Pattern: `(mixerMap.get(mixerId) as any)` and similar
- Impact: Type safety bypassed; could silently fail if Map.get returns undefined
- Fix approach: Create proper TypeScript types for ID mapping or use type-safe wrapper functions

**Missing Null Checks on Map.get():**
- Issue: `mixerMap.get()`, `ioDeviceMap.get()`, `portMap.get()` can return undefined but are cast to any
- Files: `convex/projects.ts` (lines 203-206, 221-222)
- Risk: If a reference is missing from map, duplicate could create broken data
- Fix approach: Validate all map lookups before use, throw errors on missing references

## Performance Concerns

**Excessive Database Queries in Patching Operations:**
- Issue: `getAllPatchingData` and `getAvailablePorts` queries fetch all ports for all IO devices sequentially, then perform client-side sorting and filtering
- Files: `convex/patching.ts` (lines 7-179, 243-329)
- Current approach: Promise.all fetches ports for each device in parallel, but this happens for every query call
- Impact: On projects with many devices (20+), queries become slow as port count scales linearly
- Scaling limit: ~500-1000 ports before query times become noticeable (100+ ms)
- Improvement path: Add database indexes on `(ioDeviceId, type, subType)` compound index; consider caching port data or using pagination

**Inefficient Auto-Patch Algorithm for Large Channel Sets:**
- Issue: `autoPatchInputChannels` and `autoPatchOutputChannels` loop through channels multiple times, rebuilding usedPorts set on each call
- Files: `convex/patching.ts` (lines 424-557, 561-691)
- Current: O(n*m) complexity where n is channels and m is ports per device
- Impact: Patching 100+ channels becomes noticeably slow (500+ ms)
- Fix approach: Optimize port search with early termination; cache used ports instead of rebuilding

**Repeated List Sorting in Channel Operations:**
- Issue: Every query result (input/output channels) is sorted in memory: `channels.sort((a, b) => a.order - b.order)`
- Files: `convex/inputChannels.ts` (line 13), `convex/outputChannels.ts` (line 13)
- Impact: Minor, but unnecessary for every query call
- Fix approach: Ensure `order` field has unique compound indexes so Convex returns pre-sorted results

## Data Integrity Issues

**Weak Stereo Channel Toggle Logic:**
- Issue: `toggleStereo` in both input and output channels has questionable logic
- Files: `convex/inputChannels.ts` (lines 243-263), `convex/outputChannels.ts` (lines 143-163)
- Problem: When `isStereo` is undefined/falsy, it tries to set to true but checks `if (newIsStereo)` which passes. However, if switching from stereo to mono, the right fields are cleared. This asymmetry could leave invalid state.
- Impact: Channel stereo state could become inconsistent with port assignments
- Fix approach: Rewrite as explicit state machine (mono → stereo → mono with proper validation)

**Missing Validation on Port Type Assignments:**
- Issue: When assigning ports to channels, port type validation exists but is not sufficient
- Files: `convex/patching.ts` (lines 332-377, 380-421)
- Gap: No validation that the port belongs to the same IO device as previously assigned ports in stereo pairs
- Impact: Could theoretically assign ports from different devices to left/right stereo pair
- Fix approach: When assigning stereo right port, verify it's from the same IO device as left port

**Channel Count Mismatch During Port Updates:**
- Issue: `updatePortCounts` in ioDevices can leave channels with dangling references
- Files: `convex/ioDevices.ts` (lines 356-664)
- Current: Clears port references when ports are removed, but doesn't validate that updated count matches actual port objects
- Impact: Could create inconsistent data if operation partially fails
- Fix approach: Use database transactions or ensure operation is idempotent

## Testing Coverage Gaps

**No E2E Tests for Authorization:**
- Issue: E2E tests exist but don't test cross-user access or permission violations
- Files: `e2e/` directory (all specs)
- Gap: No test for "user A cannot access user B's project"
- Risk: Authorization bypass could go undetected
- Priority: High - add tests for access control violations

**Missing Tests for Data Integrity:**
- Issue: No tests for cascade deletion or orphaned references
- Files: No test coverage for ioDevices.remove() cascading deletes
- Gap: What happens if a port is deleted while a channel references it?
- Risk: Silent data corruption
- Priority: High - add cascade deletion tests

**Auto-Patch Edge Cases Untested:**
- Issue: Auto-patch logic for stereo channels and skipAssigned flag not tested
- Files: `convex/patching.ts` (lines 424-557, 561-691)
- Scenarios: stereo with odd port count, all ports used, mixed mono/stereo
- Priority: Medium - add parameterized tests

**No Tests for Large Datasets:**
- Issue: All tests use small datasets (< 100 items)
- Files: `convex/*.test.ts`
- Gap: Performance regressions won't be caught (e.g., O(n²) algorithms)
- Priority: Medium - add load tests with 1000+ channels

## Fragile Areas

**Channel Reordering Swap Logic:**
- Files: `convex/inputChannels.ts` (lines 266-300), `convex/outputChannels.ts` (lines 165-200)
- Fragility: Complex object destructuring to separate metadata from data fields using pattern `{ _id, _creationTime, projectId, order, channelNumber, ...data }`
- Why fragile: If schema adds new required field, the swap silently breaks
- Safe modification: Use explicit field lists instead of rest parameters; add schema change tests
- Test coverage: Only basic move tests exist, no edge cases (boundary moves, invalid IDs)

**Project Duplication with Complex ID Mapping:**
- Files: `convex/projects.ts` (lines 107-227)
- Fragility: Three nested Maps (mixerMap, ioDeviceMap, portMap) with no validation that all references are present
- Why fragile: If any relationship is missed, duplication creates broken data
- Safe modification: Add explicit validation before and after duplication; write test that verifies all cross-references
- Test coverage: `projects.test.ts` has basic duplication test but no verification of all nested data

**Port Label Generation with Hardcoded Assumptions:**
- Files: `convex/ioDevices.ts` (lines 199-263, 320-354)
- Fragility: Port number calculations assume specific offsets (e.g., headphone ports start at `outputCount + 1`)
- Why fragile: If port creation logic changes, labels become out of sync; updatePortLabels won't catch it
- Safe modification: Centralize port numbering logic; validate consistency on updates

## Scaling Limits

**Channel List Performance with Large Projects:**
- Limit: ~500+ channels before UI table renders slowly (2+ seconds)
- Cause: All channels loaded and sorted in memory; table re-renders on every channel update
- Files: `src/components/project/input-channel-table.tsx`, `src/components/project/output-channel-table.tsx`
- Solution: Implement virtual scrolling (window-based rendering); paginate queries

**IO Devices Port Management:**
- Current capacity: ~100 ports per device before port dropdowns become unwieldy
- Limit: ~500 total ports across all devices before port queries timeout (> 5 seconds)
- Files: `convex/patching.ts` (port queries)
- Solution: Add port filtering/search; implement lazy loading in dropdowns

**Concurrent Edits During Auto-Patch:**
- Issue: Auto-patch loops through channels with sequential patches; no locking
- Limit: If multiple users auto-patch overlapping channels simultaneously, results are unpredictable
- Files: `convex/patching.ts` (lines 424-557)
- Solution: Add conflict detection or use database-level atomicity (if available in Convex)

## Technical Debt

**Duplicate Code in Input/Output Channels:**
- Issue: `inputChannels.ts` and `outputChannels.ts` have nearly identical implementations
- Files: `convex/inputChannels.ts`, `convex/outputChannels.ts`
- Duplication: ~600 LOC of duplicated logic (list, create, update, remove, moveChannel, toggleStereo, generateChannelsUpTo)
- Impact: Bug fixes must be applied twice; maintenance burden increases
- Fix approach: Extract shared logic into a factory function or generic module

**Incomplete Stereo Mode Implementation:**
- Issue: Stereo mode (linked_mono vs true_stereo) is stored but not fully enforced
- Files: `convex/schema.ts`, `convex/mixers.ts`
- Gap: Mixer stereo mode is never validated when creating/updating channels
- Impact: True stereo channels could be created for mono mixers
- Fix approach: Add validation in channel creation that respects mixer stereo mode

**Missing Environment Configuration:**
- Issue: Hard-coded default values scattered throughout code
- Files: `convex/projects.ts` (line 35: `channelCount ?? 48`), `convex/ioDevices.ts` (line 172: `portsPerRow ?? 12`)
- Impact: Changes require code updates and redeployment
- Fix approach: Move defaults to configurable schema or environment variables

## Missing Features / Incomplete Implementation

**Users Table Unused:**
- Issue: `users` table defined in schema but never populated or queried
- Files: `convex/schema.ts` (lines 5-11)
- Impact: User metadata (tier, lastLoginAt) cannot be used; authentication identity is lost
- Priority: Low - implement when authentication is added

**Templates and Block Presets Partially Implemented:**
- Issue: `templates` and `blockPresets` tables exist but not fully integrated
- Files: `convex/schema.ts` (lines 126-149), `convex/blockPresets.ts`
- Gap: UI for template management missing; blockPresets.create() exists but no UI
- Priority: Medium - implement UI or remove unused schema tables

**Groups System Never Used:**
- Issue: `groups` table and `groupId` field in channels exist but no grouping UI/logic
- Files: `convex/schema.ts` (lines 71-77), channel tables (groupId fields)
- Gap: No way to create, edit, or organize groups; no visual grouping in tables
- Priority: Medium - either implement or remove to reduce schema complexity

## Known Bugs & Quirks

**Port Label Mismatch on Device Rename:**
- Issue: When IO device shortName changes, port labels are updated, but display in dropdowns may not refresh
- Files: `convex/ioDevices.ts` (lines 319-354)
- Symptom: Old port labels shown in UI after device rename until page refresh
- Workaround: Refresh browser
- Fix: Ensure Convex reactivity triggers port data refetch after label update

**Order Field Null Handling Inconsistent:**
- Issue: `order` field can be null/undefined in ioDevices; sorting uses `(a.order ?? 0)`
- Files: `convex/ioDevices.ts` (lines 12, 27, 106, 266, 682)
- Symptom: New devices without explicit order appear at top of list randomly
- Fix: Set default order value on creation; ensure all devices have valid order

---

*Concerns audit: 2026-01-21*
