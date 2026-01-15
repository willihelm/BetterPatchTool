import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users
  users: defineTable({
    email: v.string(),
    name: v.string(),
    tier: v.union(v.literal("free"), v.literal("pro"), v.literal("team")),
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
    .index("by_archived", ["isArchived"]),

  // Mixers
  mixers: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    type: v.optional(v.string()), // e.g. "Yamaha CL5", "DiGiCo SD12"
    stereoMode: v.union(v.literal("linked_mono"), v.literal("true_stereo")),
    channelCount: v.number(),
    designation: v.string(), // A, B, C
  }).index("by_project", ["projectId"]),

  // Stageboxes
  stageboxes: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    shortName: v.string(), // for port prefix
    color: v.string(), // Hex color
    inputCount: v.number(),
    outputCount: v.number(),
    position: v.optional(v.object({ x: v.number(), y: v.number() })),
  }).index("by_project", ["projectId"]),

  // Stagebox-Ports
  stageboxPorts: defineTable({
    stageboxId: v.id("stageboxes"),
    type: v.union(v.literal("input"), v.literal("output")),
    portNumber: v.number(),
    label: v.string(), // e.g. "IOX-D-I1"
  })
    .index("by_stagebox", ["stageboxId"])
    .index("by_stagebox_and_type", ["stageboxId", "type"]),

  // Groups (for channel grouping)
  groups: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    color: v.optional(v.string()),
    order: v.number(),
  }).index("by_project", ["projectId"]),

  // Input Channels
  inputChannels: defineTable({
    projectId: v.id("projects"),
    order: v.number(),
    mixerId: v.optional(v.id("mixers")),
    channelNumber: v.number(),
    stageboxPortId: v.optional(v.id("stageboxPorts")),
    // For True Stereo: second port
    stageboxPortIdRight: v.optional(v.id("stageboxPorts")),
    source: v.string(),
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
    .index("by_group", ["groupId"]),

  // Output Channels
  outputChannels: defineTable({
    projectId: v.id("projects"),
    order: v.number(),
    mixerId: v.optional(v.id("mixers")),
    busName: v.string(),
    stageboxPortId: v.optional(v.id("stageboxPorts")),
    destination: v.string(),
    ampProcessor: v.optional(v.string()),
    location: v.optional(v.string()),
    cable: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_order", ["projectId", "order"]),

  // Templates
  templates: defineTable({
    userId: v.string(),
    name: v.string(),
    type: v.union(
      v.literal("project"),
      v.literal("input_group"),
      v.literal("stagebox")
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
});
