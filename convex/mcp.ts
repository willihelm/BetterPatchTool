import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { z } from "zod";
import { getAuthUserId } from "@convex-dev/auth/server";
import { logProjectActivity } from "./_helpers/projectActivity";
import { constantTimeEqual, hashMcpClientSecret } from "./_helpers/mcpCredentials";

type McpErrorCode = "unauthorized" | "forbidden" | "invalid_arguments" | "not_found";

function throwMcpError(code: McpErrorCode, message: string): never {
  throw new Error(`MCP_ERROR:${code}:${message}`);
}

async function requireMcpUserId(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throwMcpError("unauthorized", "Not authenticated");
  }
  return userId;
}

async function authenticateMcpClientCredentials(ctx: any, clientId: string, clientSecret: string) {
  const secretHash = await hashMcpClientSecret(clientId, clientSecret);
  const candidates = await ctx.db
    .query("mcpCredentials")
    .withIndex("by_clientId", (q: any) => q.eq("clientId", clientId))
    .collect();

  for (const candidate of candidates) {
    if (candidate.revokedAt) continue;
    if (constantTimeEqual(candidate.clientSecretHash, secretHash)) {
      await ctx.db.patch(candidate._id, { lastUsedAt: Date.now() });
      return candidate.userId;
    }
  }

  throwMcpError("unauthorized", "Invalid client credentials");
}

async function getProjectAccessForUser(ctx: any, projectId: Id<"projects">, userId: string) {
  const project = await ctx.db.get(projectId);
  if (!project) return null;

  if (project.ownerId === userId) {
    return { role: "owner" as const, project };
  }

  const collaborator = await ctx.db
    .query("projectCollaborators")
    .withIndex("by_project_and_user", (q: any) => q.eq("projectId", projectId).eq("userId", userId))
    .first();

  if (!collaborator) return null;
  return { role: collaborator.role, project };
}

function roleRank(role: "owner" | "editor" | "viewer") {
  switch (role) {
    case "owner":
      return 3;
    case "editor":
      return 2;
    default:
      return 1;
  }
}

async function requireProjectRoleForUser(
  ctx: any,
  projectId: Id<"projects">,
  userId: string,
  minimumRole: "viewer" | "editor" | "owner"
) {
  const access = await getProjectAccessForUser(ctx, projectId, userId);
  if (!access) throwMcpError("forbidden", "No access to project");
  if (roleRank(access.role) < roleRank(minimumRole)) {
    throwMcpError("forbidden", "Insufficient project role");
  }
  return access;
}

const updateProjectMetaSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(160).optional(),
  date: z.string().min(1).max(64).optional(),
  venue: z.string().min(1).max(160).optional(),
});

const updateInputChannelSchema = z.object({
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
});

const updateOutputChannelSchema = z.object({
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
});

function ensureHasUpdateFields(
  updates: Record<string, unknown>,
  idKey: "projectId" | "channelId"
) {
  const entries = Object.entries(updates).filter(([key, value]) => key !== idKey && value !== undefined);
  if (entries.length === 0) {
    throwMcpError("invalid_arguments", "At least one updatable field is required");
  }
}

function parseArgs<T>(schema: z.ZodType<T>, rawArgs: unknown): T {
  const parsed = schema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    throwMcpError("invalid_arguments", parsed.error.issues[0]?.message ?? "Invalid arguments");
  }
  return parsed.data;
}

async function listProjectsForUser(ctx: any, userId: string) {
  const ownedProjects = await ctx.db
    .query("projects")
    .withIndex("by_owner_and_archived", (q: any) => q.eq("ownerId", userId).eq("isArchived", false))
    .collect();

  const memberships = await ctx.db
    .query("projectCollaborators")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();

  const sharedProjects = await Promise.all(
    memberships.map(async (membership: any) => {
      const project = await ctx.db.get(membership.projectId);
      if (!project || project.isArchived) return null;
      return {
        ...project,
        accessRole: membership.role,
        isOwned: false,
      };
    })
  );

  return [
    ...ownedProjects.map((project: any) => ({
      ...project,
      accessRole: "owner" as const,
      isOwned: true,
    })),
    ...sharedProjects.filter(Boolean),
  ];
}

async function listIODevicesWithPorts(ctx: any, projectId: Id<"projects">) {
  const ioDevices = await ctx.db
    .query("ioDevices")
    .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
    .collect();

  const sortedDevices = ioDevices.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  const allPortsArrays = await Promise.all(
    sortedDevices.map((device: any) =>
      ctx.db
        .query("ioPorts")
        .withIndex("by_ioDevice", (q: any) => q.eq("ioDeviceId", device._id))
        .collect()
    )
  );

  return sortedDevices.map((device: any, index: number) => {
    const ports = allPortsArrays[index];
    return {
      ...device,
      inputPorts: ports
        .filter((p: any) => p.type === "input" && (!p.subType || p.subType === "regular"))
        .sort((a: any, b: any) => a.portNumber - b.portNumber),
      outputPorts: ports
        .filter((p: any) => p.type === "output" && (!p.subType || p.subType === "regular"))
        .sort((a: any, b: any) => a.portNumber - b.portNumber),
      headphonePorts: ports
        .filter((p: any) => p.subType === "headphone_left" || p.subType === "headphone_right")
        .sort((a: any, b: any) => a.portNumber - b.portNumber),
      aesInputPorts: ports
        .filter((p: any) => p.type === "input" && (p.subType === "aes_left" || p.subType === "aes_right"))
        .sort((a: any, b: any) => a.portNumber - b.portNumber),
      aesOutputPorts: ports
        .filter((p: any) => p.type === "output" && (p.subType === "aes_left" || p.subType === "aes_right"))
        .sort((a: any, b: any) => a.portNumber - b.portNumber),
    };
  });
}

export const executeTool = mutation({
  args: {
    name: v.string(),
    args: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await requireMcpUserId(ctx);
    return await executeToolForUser(ctx, userId, args.name, args.args);
  },
});

export const executeToolWithClientCredentials = mutation({
  args: {
    clientId: v.string(),
    clientSecret: v.string(),
    name: v.string(),
    args: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await authenticateMcpClientCredentials(ctx, args.clientId, args.clientSecret);
    return await executeToolForUser(ctx, userId, args.name, args.args);
  },
});

async function executeToolForUser(ctx: any, userId: string, toolName: string, toolArgs: unknown) {
  switch (toolName) {
      case "list_projects": {
        return await listProjectsForUser(ctx, userId);
      }
      case "get_project": {
        const parsed = parseArgs(z.object({ projectId: z.string().min(1) }), toolArgs);
        const access = await requireProjectRoleForUser(
          ctx,
          parsed.projectId as Id<"projects">,
          userId,
          "viewer"
        );
        return {
          ...access.project,
          accessRole: access.role,
          isOwned: access.role === "owner",
        };
      }
      case "list_input_channels": {
        const parsed = parseArgs(
          z.object({ projectId: z.string().min(1), mixerId: z.string().optional() }),
          toolArgs
        );
        await requireProjectRoleForUser(ctx, parsed.projectId as Id<"projects">, userId, "viewer");
        if (parsed.mixerId) {
          const mixer = await ctx.db.get(parsed.mixerId as Id<"mixers">);
          if (!mixer || mixer.projectId !== (parsed.projectId as Id<"projects">)) {
            throwMcpError("not_found", "Mixer not found in project");
          }
          return await ctx.db
            .query("inputChannels")
            .withIndex("by_mixer_and_order", (q: any) => q.eq("mixerId", mixer._id))
            .collect();
        }
        return await ctx.db
          .query("inputChannels")
          .withIndex("by_project_and_order", (q: any) => q.eq("projectId", parsed.projectId))
          .collect();
      }
      case "list_output_channels": {
        const parsed = parseArgs(
          z.object({ projectId: z.string().min(1), mixerId: z.string().optional() }),
          toolArgs
        );
        await requireProjectRoleForUser(ctx, parsed.projectId as Id<"projects">, userId, "viewer");
        if (parsed.mixerId) {
          const mixer = await ctx.db.get(parsed.mixerId as Id<"mixers">);
          if (!mixer || mixer.projectId !== (parsed.projectId as Id<"projects">)) {
            throwMcpError("not_found", "Mixer not found in project");
          }
          return await ctx.db
            .query("outputChannels")
            .withIndex("by_mixer_and_order", (q: any) => q.eq("mixerId", mixer._id))
            .collect();
        }
        return await ctx.db
          .query("outputChannels")
          .withIndex("by_project_and_order", (q: any) => q.eq("projectId", parsed.projectId))
          .collect();
      }
      case "list_io_devices_with_ports": {
        const parsed = parseArgs(z.object({ projectId: z.string().min(1) }), toolArgs);
        await requireProjectRoleForUser(ctx, parsed.projectId as Id<"projects">, userId, "viewer");
        return await listIODevicesWithPorts(ctx, parsed.projectId as Id<"projects">);
      }
      case "update_project_meta": {
        const parsed = parseArgs(updateProjectMetaSchema, toolArgs);
        const access = await requireProjectRoleForUser(
          ctx,
          parsed.projectId as Id<"projects">,
          userId,
          "editor"
        );
        ensureHasUpdateFields(parsed, "projectId");

        const { projectId, ...updates } = parsed;
        const filteredUpdates = Object.fromEntries(
          Object.entries(updates).filter(([_, value]) => value !== undefined)
        );

        await ctx.db.patch(projectId as Id<"projects">, filteredUpdates);
        await logProjectActivity(ctx, {
          projectId: projectId as Id<"projects">,
          actorUserId: userId,
          entityType: "project",
          entityId: String(projectId),
          action: "updated",
          summary: `Updated project "${access.project.title}" via MCP`,
          metadata: filteredUpdates,
        });
        return { ok: true };
      }
      case "update_input_channel": {
        const parsed = parseArgs(updateInputChannelSchema, toolArgs);
        ensureHasUpdateFields(parsed, "channelId");
        const channel = await ctx.db.get(parsed.channelId as Id<"inputChannels">);
        if (!channel) throwMcpError("not_found", "Input channel not found");

        await requireProjectRoleForUser(ctx, channel.projectId, userId, "editor");
        const { channelId, ...updates } = parsed;
        const filteredUpdates = Object.fromEntries(
          Object.entries(updates).filter(([_, value]) => value !== undefined)
        );
        await ctx.db.patch(channelId as Id<"inputChannels">, filteredUpdates);
        await logProjectActivity(ctx, {
          projectId: channel.projectId,
          actorUserId: userId,
          entityType: "input_channel",
          entityId: String(channelId),
          action: "updated",
          summary: `Updated input channel ${channel.channelNumber} via MCP`,
          metadata: filteredUpdates,
        });
        return { ok: true };
      }
      case "update_output_channel": {
        const parsed = parseArgs(updateOutputChannelSchema, toolArgs);
        ensureHasUpdateFields(parsed, "channelId");
        const channel = await ctx.db.get(parsed.channelId as Id<"outputChannels">);
        if (!channel) throwMcpError("not_found", "Output channel not found");

        await requireProjectRoleForUser(ctx, channel.projectId, userId, "editor");
        const { channelId, ...updates } = parsed;
        const filteredUpdates = Object.fromEntries(
          Object.entries(updates).filter(([_, value]) => value !== undefined)
        );
        await ctx.db.patch(channelId as Id<"outputChannels">, filteredUpdates);
        await logProjectActivity(ctx, {
          projectId: channel.projectId,
          actorUserId: userId,
          entityType: "output_channel",
          entityId: String(channelId),
          action: "updated",
          summary: `Updated output channel ${channel.busName || channel.order} via MCP`,
          metadata: filteredUpdates,
        });
        return { ok: true };
      }
      default:
        throwMcpError("invalid_arguments", `Unknown tool "${toolName}"`);
  }
}
