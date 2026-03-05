import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  // Users (extends authTables.users with custom fields)
  users: defineTable({
    // Auth fields (managed by Convex Auth, may be null from OAuth providers)
    email: v.optional(v.union(v.string(), v.null())),
    name: v.optional(v.union(v.string(), v.null())),
    image: v.optional(v.union(v.string(), v.null())),
    emailVerificationTime: v.optional(v.union(v.number(), v.null())),
    isAnonymous: v.optional(v.boolean()),
    // Custom fields
    tier: v.optional(v.union(v.literal("free"), v.literal("pro"), v.literal("team"))),
    lastLoginAt: v.optional(v.number()),
  }).index("by_email", ["email"]),

  // Projects
  projects: defineTable({
    title: v.string(),
    date: v.optional(v.string()), // ISO date string
    venue: v.optional(v.string()),
    ownerId: v.string(),
    collaborators: v.array(v.string()),
    isArchived: v.boolean(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_and_archived", ["ownerId", "isArchived"])
    .index("by_archived", ["isArchived"]),

  // Mixers
  mixers: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    type: v.optional(v.string()), // e.g. "Yamaha CL5", "DiGiCo SD12"
    stereoMode: v.union(v.literal("linked_mono"), v.literal("true_stereo")),
    channelCount: v.number(),
    designation: v.string(), // A, B, C
    order: v.optional(v.number()), // Display order
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_order", ["projectId", "order"]),

  // IO Devices (stageboxes, computers, etc.)
  ioDevices: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    shortName: v.string(), // for port prefix
    color: v.string(), // Hex color
    inputCount: v.number(),
    outputCount: v.number(),
    headphoneOutputCount: v.optional(v.number()), // Number of stereo HP pairs
    aesInputCount: v.optional(v.number()), // Number of stereo AES input pairs
    aesOutputCount: v.optional(v.number()), // Number of stereo AES output pairs
    position: v.optional(v.object({ x: v.number(), y: v.number() })),
    deviceType: v.optional(v.union(v.literal("stagebox"), v.literal("generic"))), // default: stagebox
    portsPerRow: v.optional(v.number()), // default 12 for stagebox grid view
    order: v.optional(v.number()), // Display order
  }).index("by_project", ["projectId"]),

  // IO Ports
  ioPorts: defineTable({
    ioDeviceId: v.id("ioDevices"),
    type: v.union(v.literal("input"), v.literal("output")),
    portNumber: v.number(),
    label: v.string(), // e.g. "IOX-D-I1"
    subType: v.optional(v.union(
      v.literal("regular"),
      v.literal("headphone_left"),
      v.literal("headphone_right"),
      v.literal("aes_left"),
      v.literal("aes_right")
    )),
    headphoneNumber: v.optional(v.number()), // Which HP pair (1, 2, 3...)
    aesNumber: v.optional(v.number()), // Which AES pair (1, 2, 3...)
  })
    .index("by_ioDevice", ["ioDeviceId"])
    .index("by_ioDevice_and_type", ["ioDeviceId", "type"]),

  // Groups (for channel grouping)
  groups: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    color: v.optional(v.string()),
    order: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_order", ["projectId", "order"]),

  // Input Channels
  inputChannels: defineTable({
    projectId: v.id("projects"),
    order: v.number(),
    mixerId: v.optional(v.id("mixers")),
    channelNumber: v.number(),
    ioPortId: v.optional(v.id("ioPorts")),
    // For True Stereo: second port
    ioPortIdRight: v.optional(v.id("ioPorts")),
    isStereo: v.optional(v.boolean()),
    source: v.string(),
    sourceRight: v.optional(v.string()),
    uhf: v.optional(v.string()),
    micInputDev: v.optional(v.string()),
    patched: v.boolean(),
    location: v.optional(v.string()),
    cable: v.optional(v.string()),
    stand: v.optional(v.string()),
    notes: v.optional(v.string()),
    groupId: v.optional(v.id("groups")),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_order", ["projectId", "order"])
    .index("by_mixer", ["mixerId"])
    .index("by_mixer_and_order", ["mixerId", "order"])
    .index("by_group", ["groupId"])
    .index("by_ioPort", ["ioPortId"])
    .index("by_ioPortRight", ["ioPortIdRight"]),

  // Output Channels
  outputChannels: defineTable({
    projectId: v.id("projects"),
    order: v.number(),
    mixerId: v.optional(v.id("mixers")),
    busName: v.string(),
    ioPortId: v.optional(v.id("ioPorts")),
    // For True Stereo: second port
    ioPortIdRight: v.optional(v.id("ioPorts")),
    isStereo: v.optional(v.boolean()),
    destination: v.string(),
    destinationRight: v.optional(v.string()),
    ampProcessor: v.optional(v.string()),
    location: v.optional(v.string()),
    cable: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_order", ["projectId", "order"])
    .index("by_mixer", ["mixerId"])
    .index("by_mixer_and_order", ["mixerId", "order"])
    .index("by_ioPort", ["ioPortId"])
    .index("by_ioPortRight", ["ioPortIdRight"]),

  // Templates
  templates: defineTable({
    userId: v.string(),
    name: v.string(),
    type: v.union(
      v.literal("project"),
      v.literal("input_group"),
      v.literal("io_device")
    ),
    data: v.string(), // JSON stringified
  })
    .index("by_user", ["userId"])
    .index("by_type", ["type"]),

  // Block-Presets
  blockPresets: defineTable({
    userId: v.optional(v.string()), // null für System-Presets
    name: v.string(),
    description: v.optional(v.string()),
    isPublic: v.boolean(),
    channels: v.string(), // JSON array von Kanal-Definitionen
  })
    .index("by_user", ["userId"])
    .index("by_public", ["isPublic"]),

  // Project Snapshots
  projectSnapshots: defineTable({
    projectId: v.id("projects"),
    createdBy: v.string(),
    createdAt: v.number(),
    name: v.string(),
    note: v.optional(v.string()),
    dataVersion: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_createdAt", ["projectId", "createdAt"]),

  projectSnapshotData: defineTable({
    snapshotId: v.id("projectSnapshots"),
    blob: v.string(),
    compression: v.optional(v.literal("none")),
  }).index("by_snapshot", ["snapshotId"]),
});
