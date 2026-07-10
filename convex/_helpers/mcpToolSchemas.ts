import { z } from "zod";

// Single source of truth for the MCP tool surface. The Next.js transport
// (src/app/api/[transport]/route.ts) registers these with the MCP server and
// convex/mcp.ts validates incoming arguments against the same shapes, so the
// advertised schemas and the enforced ones cannot drift.

export const updateProjectMetaShape = {
  projectId: z.string().min(1),
  title: z.string().min(1).max(160).optional(),
  date: z.string().min(1).max(64).optional(),
  venue: z.string().min(1).max(160).optional(),
};

export const updateInputChannelShape = {
  channelId: z.string().min(1),
  source: z.string().optional(),
  sourceRight: z.string().optional(),
  uhf: z.string().optional(),
  micInputDev: z.string().optional(),
  patched: z.boolean().optional(),
  location: z.string().optional(),
  cable: z.string().optional(),
  stand: z.string().optional(),
  notes: z.string().optional(),
  ioPortId: z.string().optional(),
  ioPortIdRight: z.string().optional(),
  isStereo: z.boolean().optional(),
  groupId: z.string().optional(),
  channelNumber: z.number().int().positive().optional(),
};

export const updateOutputChannelShape = {
  channelId: z.string().min(1),
  busType: z.enum(["group", "aux", "fx", "matrix", "master", "cue"]).optional(),
  busName: z.string().optional(),
  destination: z.string().optional(),
  destinationRight: z.string().optional(),
  ampProcessor: z.string().optional(),
  location: z.string().optional(),
  cable: z.string().optional(),
  notes: z.string().optional(),
  ioPortId: z.string().optional(),
  ioPortIdRight: z.string().optional(),
  isStereo: z.boolean().optional(),
};

export const mcpToolDefinitions = {
  list_projects: {
    description: "List projects visible to the authenticated user.",
    inputShape: {},
  },
  get_project: {
    description: "Get one project including access role.",
    inputShape: { projectId: z.string().min(1) },
  },
  list_input_channels: {
    description: "List input channels for a project and optional mixer.",
    inputShape: { projectId: z.string().min(1), mixerId: z.string().optional() },
  },
  list_output_channels: {
    description: "List output channels for a project and optional mixer.",
    inputShape: { projectId: z.string().min(1), mixerId: z.string().optional() },
  },
  list_io_devices_with_ports: {
    description: "List IO devices with their port groups for one project.",
    inputShape: { projectId: z.string().min(1) },
  },
  update_project_meta: {
    description: "Update project title/date/venue for an editor or owner.",
    inputShape: updateProjectMetaShape,
  },
  update_input_channel: {
    description: "Update one input channel with allowlisted fields.",
    inputShape: updateInputChannelShape,
  },
  update_output_channel: {
    description: "Update one output channel with allowlisted fields.",
    inputShape: updateOutputChannelShape,
  },
} as const satisfies Record<string, { description: string; inputShape: z.ZodRawShape }>;

export type McpToolName = keyof typeof mcpToolDefinitions;
