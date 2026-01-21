---
path: /Users/wilhelmduck/git/BetterPatchTool/convex/patching.ts
type: api
updated: 2026-01-21
status: active
---

# patching.ts

## Purpose

Convex API module that handles all audio patching operations between channels and I/O device ports. Provides queries for fetching patching data and port availability, plus mutations for manual patching, auto-patching, batch operations, and clearing patches.

## Exports

- `getAllPatchingData` - Query that fetches all patching-related data (ioDevices, channels, ports, usage maps) in a single optimized call
- `getPortUsageMap` - Query that returns a map of port IDs to their usage info (channel type, id, name, number)
- `getAvailablePorts` - Query that returns available (unpatched) ports filtered by direction and optional device
- `patchInputChannel` - Mutation to patch an input channel to a specific I/O port (supports stereo right channel)
- `patchOutputChannel` - Mutation to patch an output channel to a specific I/O port
- `autoPatchInputChannels` - Mutation that automatically patches multiple input channels to sequential available ports
- `autoPatchOutputChannels` - Mutation that automatically patches multiple output channels to sequential available ports
- `batchPatchChannels` - Mutation to apply multiple patch assignments in a single transaction
- `clearPatches` - Mutation to clear patches from specified channels or all channels of a type

## Dependencies

- `convex/values` - Convex value validators
- `./_generated/server` - Convex query/mutation functions
- `./_generated/dataModel` - Convex Id types

## Used By

TBD

## Notes

- Uses parallel Promise.all fetching to minimize query latency
- Builds in-memory lookup maps for port usage to avoid repeated DB queries
- Auto-patch functions find sequential available ports on a specified device
- Supports stereo input channels with separate left/right port assignments