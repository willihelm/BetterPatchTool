import { ConvexError, v } from "convex/values";
import { mutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { z } from "zod";
import { logProjectActivity } from "./_helpers/projectActivity";
import { isAllowedTokenAudience, sha256Base64Url } from "./_helpers/mcpOAuth";
import {
  updateInputChannelShape,
  updateOutputChannelShape,
  updateProjectMetaShape,
} from "./_helpers/mcpToolSchemas";

type McpErrorCode = "unauthorized" | "forbidden" | "invalid_arguments" | "not_found";

// ConvexError so the MCP_ERROR code survives prod redaction and reaches the transport route.
function throwMcpError(code: McpErrorCode, message: string): never {
  throw new ConvexError(`MCP_ERROR:${code}:${message}`);
}

async function authenticateMcpOAuthAccessToken(ctx: MutationCtx, accessToken: string) {
  const tokenHash = await sha256Base64Url(accessToken);
  const tokenDoc = await ctx.db
    .query("mcpOAuthAccessTokens")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .first();

  if (!tokenDoc || tokenDoc.revokedAt || tokenDoc.expiresAt <= Date.now()) {
    throwMcpError("unauthorized", "Invalid OAuth access token");
  }

  // RFC 8707 audience binding; tokens without a resource predate audience
  // enforcement and expire within an hour of the migration deploy.
  if (!isAllowedTokenAudience(tokenDoc.resource)) {
    throwMcpError("unauthorized", "Invalid OAuth access token");
  }

  await ctx.db.patch(tokenDoc._id, { lastUsedAt: Date.now() });
  return tokenDoc.userId;
}

async function getProjectAccessForUser(ctx: QueryCtx, projectId: Id<"projects">, userId: string) {
  const project = await ctx.db.get(projectId);
  if (!project) return null;

  if (project.ownerId === userId) {
    return { role: "owner" as const, project };
  }

  const collaborator = await ctx.db
    .query("projectCollaborators")
    .withIndex("by_project_and_user", (q) => q.eq("projectId", projectId).eq("userId", userId))
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
  ctx: QueryCtx,
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

const updateProjectMetaSchema = z.object(updateProjectMetaShape);
const updateInputChannelSchema = z.object(updateInputChannelShape);
const updateOutputChannelSchema = z.object(updateOutputChannelShape);

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

async function listProjectsForUser(ctx: QueryCtx, userId: string) {
  const ownedProjects = await ctx.db
    .query("projects")
    .withIndex("by_owner_and_archived", (q) => q.eq("ownerId", userId).eq("isArchived", false))
    .collect();

  const memberships = await ctx.db
    .query("projectCollaborators")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  const sharedProjects = await Promise.all(
    memberships.map(async (membership) => {
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
    ...ownedProjects.map((project) => ({
      ...project,
      accessRole: "owner" as const,
      isOwned: true,
    })),
    ...sharedProjects.filter((project) => project !== null),
  ];
}

async function listIODevicesWithPorts(ctx: QueryCtx, projectId: Id<"projects">) {
  const ioDevices = await ctx.db
    .query("ioDevices")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect();

  const sortedDevices = ioDevices.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const allPortsArrays = await Promise.all(
    sortedDevices.map((device) =>
      ctx.db
        .query("ioPorts")
        .withIndex("by_ioDevice", (q) => q.eq("ioDeviceId", device._id))
        .collect()
    )
  );

  return sortedDevices.map((device, index) => {
    const ports = allPortsArrays[index];
    return {
      ...device,
      inputPorts: ports
        .filter((p) => p.type === "input" && (!p.subType || p.subType === "regular"))
        .sort((a, b) => a.portNumber - b.portNumber),
      outputPorts: ports
        .filter((p) => p.type === "output" && (!p.subType || p.subType === "regular"))
        .sort((a, b) => a.portNumber - b.portNumber),
      headphonePorts: ports
        .filter((p) => p.subType === "headphone_left" || p.subType === "headphone_right")
        .sort((a, b) => a.portNumber - b.portNumber),
      aesInputPorts: ports
        .filter((p) => p.type === "input" && (p.subType === "aes_left" || p.subType === "aes_right"))
        .sort((a, b) => a.portNumber - b.portNumber),
      aesOutputPorts: ports
        .filter((p) => p.type === "output" && (p.subType === "aes_left" || p.subType === "aes_right"))
        .sort((a, b) => a.portNumber - b.portNumber),
    };
  });
}

export const executeToolWithOAuthAccessToken = mutation({
  args: {
    accessToken: v.string(),
    name: v.string(),
    args: v.optional(v.record(v.string(), v.any())),
  },
  handler: async (ctx, args) => {
    const userId = await authenticateMcpOAuthAccessToken(ctx, args.accessToken);
    return await executeToolForUser(ctx, userId, args.name, args.args);
  },
});

function normalizeIdOrThrow<TableName extends "projects" | "mixers" | "inputChannels" | "outputChannels">(
  ctx: QueryCtx,
  table: TableName,
  id: string,
  label: string
) {
  const normalized = ctx.db.normalizeId(table, id);
  if (!normalized) throwMcpError("not_found", `${label} not found`);
  return normalized;
}

// Normalizes a port reference and verifies type and project membership before it is written.
async function verifyPortForProject(
  ctx: QueryCtx,
  rawPortId: string,
  projectId: Id<"projects">,
  expectedType: "input" | "output"
) {
  const portId = ctx.db.normalizeId("ioPorts", rawPortId);
  if (!portId) throwMcpError("not_found", "Port not found");
  const port = await ctx.db.get(portId);
  if (!port || port.type !== expectedType) {
    throwMcpError("invalid_arguments", `Port must be an existing ${expectedType} port`);
  }
  const device = await ctx.db.get(port.ioDeviceId);
  if (!device || device.projectId !== projectId) {
    throwMcpError("forbidden", "Port does not belong to this project");
  }
  return portId;
}

async function executeToolForUser(ctx: MutationCtx, userId: string, toolName: string, toolArgs: unknown) {
  switch (toolName) {
      case "list_projects": {
        return await listProjectsForUser(ctx, userId);
      }
      case "get_project": {
        const parsed = parseArgs(z.object({ projectId: z.string().min(1) }), toolArgs);
        const projectId = normalizeIdOrThrow(ctx, "projects", parsed.projectId, "Project");
        const access = await requireProjectRoleForUser(ctx, projectId, userId, "viewer");
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
        const projectId = normalizeIdOrThrow(ctx, "projects", parsed.projectId, "Project");
        await requireProjectRoleForUser(ctx, projectId, userId, "viewer");
        if (parsed.mixerId) {
          const mixerId = normalizeIdOrThrow(ctx, "mixers", parsed.mixerId, "Mixer");
          const mixer = await ctx.db.get(mixerId);
          if (!mixer || mixer.projectId !== projectId) {
            throwMcpError("not_found", "Mixer not found in project");
          }
          return await ctx.db
            .query("inputChannels")
            .withIndex("by_mixer_and_order", (q) => q.eq("mixerId", mixer._id))
            .collect();
        }
        return await ctx.db
          .query("inputChannels")
          .withIndex("by_project_and_order", (q) => q.eq("projectId", projectId))
          .collect();
      }
      case "list_output_channels": {
        const parsed = parseArgs(
          z.object({ projectId: z.string().min(1), mixerId: z.string().optional() }),
          toolArgs
        );
        const projectId = normalizeIdOrThrow(ctx, "projects", parsed.projectId, "Project");
        await requireProjectRoleForUser(ctx, projectId, userId, "viewer");
        if (parsed.mixerId) {
          const mixerId = normalizeIdOrThrow(ctx, "mixers", parsed.mixerId, "Mixer");
          const mixer = await ctx.db.get(mixerId);
          if (!mixer || mixer.projectId !== projectId) {
            throwMcpError("not_found", "Mixer not found in project");
          }
          return await ctx.db
            .query("outputChannels")
            .withIndex("by_mixer_and_order", (q) => q.eq("mixerId", mixer._id))
            .collect();
        }
        return await ctx.db
          .query("outputChannels")
          .withIndex("by_project_and_order", (q) => q.eq("projectId", projectId))
          .collect();
      }
      case "list_io_devices_with_ports": {
        const parsed = parseArgs(z.object({ projectId: z.string().min(1) }), toolArgs);
        const projectId = normalizeIdOrThrow(ctx, "projects", parsed.projectId, "Project");
        await requireProjectRoleForUser(ctx, projectId, userId, "viewer");
        return await listIODevicesWithPorts(ctx, projectId);
      }
      case "update_project_meta": {
        const parsed = parseArgs(updateProjectMetaSchema, toolArgs);
        const projectId = normalizeIdOrThrow(ctx, "projects", parsed.projectId, "Project");
        const access = await requireProjectRoleForUser(ctx, projectId, userId, "editor");
        ensureHasUpdateFields(parsed, "projectId");

        const { projectId: _rawProjectId, ...updates } = parsed;
        const filteredUpdates = Object.fromEntries(
          Object.entries(updates).filter(([_, value]) => value !== undefined)
        ) as Partial<Doc<"projects">>;

        await ctx.db.patch(projectId, filteredUpdates);
        await logProjectActivity(ctx, {
          projectId,
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
        const channelId = normalizeIdOrThrow(ctx, "inputChannels", parsed.channelId, "Input channel");
        const channel = await ctx.db.get(channelId);
        if (!channel) throwMcpError("not_found", "Input channel not found");

        await requireProjectRoleForUser(ctx, channel.projectId, userId, "editor");
        const { channelId: _rawChannelId, ...updates } = parsed;
        const filteredUpdates = Object.fromEntries(
          Object.entries(updates).filter(([_, value]) => value !== undefined)
        ) as Partial<Doc<"inputChannels">>;
        if (typeof filteredUpdates.ioPortId === "string") {
          filteredUpdates.ioPortId = await verifyPortForProject(ctx, filteredUpdates.ioPortId, channel.projectId, "input");
        }
        if (typeof filteredUpdates.ioPortIdRight === "string") {
          filteredUpdates.ioPortIdRight = await verifyPortForProject(ctx, filteredUpdates.ioPortIdRight, channel.projectId, "input");
        }
        if (typeof filteredUpdates.groupId === "string") {
          const groupId = ctx.db.normalizeId("groups", filteredUpdates.groupId);
          if (!groupId) throwMcpError("not_found", "Group not found in project");
          const group = await ctx.db.get(groupId);
          if (!group || group.projectId !== channel.projectId) {
            throwMcpError("not_found", "Group not found in project");
          }
          filteredUpdates.groupId = groupId;
        }
        await ctx.db.patch(channelId, filteredUpdates);
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
        const channelId = normalizeIdOrThrow(ctx, "outputChannels", parsed.channelId, "Output channel");
        const channel = await ctx.db.get(channelId);
        if (!channel) throwMcpError("not_found", "Output channel not found");

        await requireProjectRoleForUser(ctx, channel.projectId, userId, "editor");
        const { channelId: _rawChannelId, ...updates } = parsed;
        const filteredUpdates = Object.fromEntries(
          Object.entries(updates).filter(([_, value]) => value !== undefined)
        ) as Partial<Doc<"outputChannels">>;
        if (typeof filteredUpdates.ioPortId === "string") {
          filteredUpdates.ioPortId = await verifyPortForProject(ctx, filteredUpdates.ioPortId, channel.projectId, "output");
        }
        if (typeof filteredUpdates.ioPortIdRight === "string") {
          filteredUpdates.ioPortIdRight = await verifyPortForProject(ctx, filteredUpdates.ioPortIdRight, channel.projectId, "output");
        }
        await ctx.db.patch(channelId, filteredUpdates);
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
