import { api } from "../../../../convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";

const MAX_BATCH_REQUESTS = 20;
const ENABLE_MCP_DEBUG_LOGS = process.env.MCP_DEBUG_LOGS === "1";

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
};

type McpAuth =
  | { kind: "oauth"; token: string }
  | { kind: "client_credentials"; clientId: string; clientSecret: string };

function mcpLog(event: string, details?: Record<string, unknown>) {
  if (!ENABLE_MCP_DEBUG_LOGS) return;
  const timestamp = new Date().toISOString();
  console.info(`[mcp-route] ${timestamp} ${event}`, details ?? {});
}

function jsonRpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(id: JsonRpcId, code: number, message: string, data?: unknown) {
  return {
    jsonrpc: "2.0",
    id,
    error: data === undefined ? { code, message } : { code, message, data },
  };
}

function parseMcpError(error: unknown): { kind: string; message: string } {
  const message = error instanceof Error ? error.message : "Unknown error";
  const match = /^MCP_ERROR:(unauthorized|forbidden|invalid_arguments|not_found):([\s\S]*)$/.exec(message);
  if (!match) return { kind: "internal", message };
  return { kind: match[1], message: match[2].trim() };
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;
  const separatorIndex = authorization.indexOf(" ");
  if (separatorIndex < 1) return null;
  const scheme = authorization.slice(0, separatorIndex);
  const token = authorization.slice(separatorIndex + 1);
  if (!token || scheme.toLowerCase() !== "bearer") return null;
  return token.trim();
}

function getBasicCredentials(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;
  const [scheme, encoded] = authorization.split(" ");
  if (!scheme || !encoded || scheme.toLowerCase() !== "basic") return null;

  try {
    const decoded = atob(encoded);
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex < 1) return null;
    const clientId = decoded.slice(0, separatorIndex).trim();
    const clientSecret = decoded.slice(separatorIndex + 1).trim();
    if (!clientId || !clientSecret) return null;
    return { clientId, clientSecret };
  } catch {
    return null;
  }
}

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  return new ConvexHttpClient(url);
}

function getTools() {
  return [
    {
      name: "list_projects",
      description: "List projects visible to the authenticated user.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "get_project",
      description: "Get one project including access role.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string" },
        },
        required: ["projectId"],
        additionalProperties: false,
      },
    },
    {
      name: "list_input_channels",
      description: "List input channels for a project and optional mixer.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string" },
          mixerId: { type: "string" },
        },
        required: ["projectId"],
        additionalProperties: false,
      },
    },
    {
      name: "list_output_channels",
      description: "List output channels for a project and optional mixer.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string" },
          mixerId: { type: "string" },
        },
        required: ["projectId"],
        additionalProperties: false,
      },
    },
    {
      name: "list_io_devices_with_ports",
      description: "List IO devices with their port groups for one project.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string" },
        },
        required: ["projectId"],
        additionalProperties: false,
      },
    },
    {
      name: "update_project_meta",
      description: "Update project title/date/venue for an editor or owner.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string" },
          title: { type: "string" },
          date: { type: "string" },
          venue: { type: "string" },
        },
        required: ["projectId"],
        additionalProperties: false,
      },
    },
    {
      name: "update_input_channel",
      description: "Update one input channel with allowlisted fields.",
      inputSchema: {
        type: "object",
        properties: {
          channelId: { type: "string" },
          source: { type: "string" },
          sourceRight: { type: "string" },
          uhf: { type: "string" },
          micInputDev: { type: "string" },
          patched: { type: "boolean" },
          location: { type: "string" },
          cable: { type: "string" },
          stand: { type: "string" },
          notes: { type: "string" },
          ioPortId: { type: "string" },
          ioPortIdRight: { type: "string" },
          isStereo: { type: "boolean" },
          groupId: { type: "string" },
          channelNumber: { type: "number" },
        },
        required: ["channelId"],
        additionalProperties: false,
      },
    },
    {
      name: "update_output_channel",
      description: "Update one output channel with allowlisted fields.",
      inputSchema: {
        type: "object",
        properties: {
          channelId: { type: "string" },
          busType: { type: "string", enum: ["group", "aux", "fx", "matrix", "master", "cue"] },
          busName: { type: "string" },
          destination: { type: "string" },
          destinationRight: { type: "string" },
          ampProcessor: { type: "string" },
          location: { type: "string" },
          cable: { type: "string" },
          notes: { type: "string" },
          ioPortId: { type: "string" },
          ioPortIdRight: { type: "string" },
          isStereo: { type: "boolean" },
        },
        required: ["channelId"],
        additionalProperties: false,
      },
    },
  ];
}

async function handleSingleRequest(req: JsonRpcRequest, auth: McpAuth | null) {
  const id = req.id ?? null;
  mcpLog("handle_single_request", {
    id,
    method: req.method ?? null,
    hasAuth: Boolean(auth),
    authKind: auth?.kind ?? null,
  });

  if (req.jsonrpc !== "2.0") {
    return jsonRpcError(id, -32600, "Invalid Request");
  }
  if (!req.method || typeof req.method !== "string") {
    return jsonRpcError(id, -32600, "Invalid Request");
  }

  if (req.method === "initialize") {
    return jsonRpcResult(id, {
      protocolVersion: "2025-03-26",
      serverInfo: { name: "betterpatchtool-mcp", version: "1.0.0" },
      capabilities: { tools: {} },
    });
  }

  if (req.method === "ping") {
    return jsonRpcResult(id, {});
  }

  if (!auth) {
    return jsonRpcError(id, -32001, "unauthorized", { code: "unauthorized" });
  }

  if (req.method === "tools/list") {
    return jsonRpcResult(id, { tools: getTools() });
  }

  if (req.method === "tools/call") {
    const toolName = typeof req.params?.name === "string" ? req.params.name : null;
    if (!toolName) {
      return jsonRpcError(id, -32602, "invalid_arguments", { code: "invalid_arguments" });
    }
    const rawArgs = req.params?.arguments;
    if (
      rawArgs !== undefined &&
      (rawArgs === null || typeof rawArgs !== "object" || Array.isArray(rawArgs))
    ) {
      return jsonRpcError(id, -32602, "invalid_arguments", { code: "invalid_arguments" });
    }
    const toolArgs = rawArgs as Record<string, unknown> | undefined;
    mcpLog("tools_call_received", {
      id,
      toolName,
      authKind: auth.kind,
      argKeys: Object.keys(toolArgs ?? {}),
    });

    const convex = getConvexClient();
    if (!convex) {
      mcpLog("missing_convex_url", { id, toolName });
      return jsonRpcError(id, -32603, "MCP endpoint is not configured", {
        code: "internal_error",
      });
    }

    try {
      let result: unknown;
      if (auth.kind === "oauth") {
        convex.setAuth(auth.token);
        try {
          result = await convex.mutation(api.mcp.executeTool, {
            name: toolName,
            args: toolArgs ?? {},
          });
        } catch (error) {
          const parsed = parseMcpError(error);
          if (parsed.kind !== "unauthorized") {
            throw error;
          }
          mcpLog("oauth_bearer_fallback", { id, toolName });
          result = await convex.mutation(api.mcp.executeToolWithOAuthAccessToken, {
            accessToken: auth.token,
            name: toolName,
            args: toolArgs ?? {},
          });
        }
      } else {
        result = await convex.mutation(api.mcp.executeToolWithClientCredentials, {
          clientId: auth.clientId,
          clientSecret: auth.clientSecret,
          name: toolName,
          args: toolArgs ?? {},
        });
      }

      mcpLog("tools_call_success", {
        id,
        toolName,
        authKind: auth.kind,
        resultType: Array.isArray(result) ? "array" : typeof result,
      });

      return jsonRpcResult(id, {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
      });
    } catch (error) {
      const parsed = parseMcpError(error);
      mcpLog("tools_call_error", {
        id,
        toolName,
        authKind: auth.kind,
        errorKind: parsed.kind,
        errorMessage: parsed.message,
      });
      if (parsed.kind === "unauthorized") {
        return jsonRpcError(id, -32001, "unauthorized", { code: "unauthorized" });
      }
      if (parsed.kind === "forbidden") {
        return jsonRpcError(id, -32003, "forbidden", { code: "forbidden", message: parsed.message });
      }
      if (parsed.kind === "invalid_arguments") {
        return jsonRpcError(id, -32602, "invalid_arguments", {
          code: "invalid_arguments",
          message: parsed.message,
        });
      }
      if (parsed.kind === "not_found") {
        return jsonRpcError(id, -32004, "not_found", { code: "not_found", message: parsed.message });
      }
      return jsonRpcError(id, -32603, "Internal error", { code: "internal_error" });
    }
  }

  return jsonRpcError(id, -32601, "Method not found");
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const authHeader = request.headers.get("authorization");
  const authScheme = authHeader ? authHeader.split(" ")[0]?.toLowerCase() ?? null : null;
  mcpLog("request_received", {
    path: url.pathname,
    authScheme,
    hasAuthHeader: Boolean(authHeader),
  });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    mcpLog("parse_error");
    return Response.json(jsonRpcError(null, -32700, "Parse error"), { status: 400 });
  }

  const bearerToken = getBearerToken(request);
  const basicCredentials = getBasicCredentials(request);
  const sessionToken = await convexAuthNextjsToken();
  const auth: McpAuth | null = bearerToken
    ? { kind: "oauth", token: bearerToken }
    : basicCredentials
      ? {
          kind: "client_credentials",
          clientId: basicCredentials.clientId,
          clientSecret: basicCredentials.clientSecret,
        }
      : sessionToken
        ? { kind: "oauth", token: sessionToken }
        : null;

  mcpLog("auth_resolved", {
    authKind: auth?.kind ?? null,
    usedBearerHeader: Boolean(bearerToken),
    usedBasicHeader: Boolean(basicCredentials),
    usedSessionToken: !bearerToken && !basicCredentials && Boolean(sessionToken),
  });

  if (Array.isArray(body)) {
    mcpLog("batch_request", { size: body.length });
    if (body.length === 0 || body.length > MAX_BATCH_REQUESTS) {
      mcpLog("batch_rejected", { size: body.length, max: MAX_BATCH_REQUESTS });
      return Response.json(jsonRpcError(null, -32600, "Invalid Request"), { status: 400 });
    }
    const responses = await Promise.all(body.map((entry) => handleSingleRequest(entry as JsonRpcRequest, auth)));
    mcpLog("batch_completed", { size: body.length });
    return Response.json(responses, {
      headers: {
        "MCP-Protocol-Version": "2025-03-26",
      },
    });
  }

  mcpLog("single_request");
  const response = await handleSingleRequest(body as JsonRpcRequest, auth);
  mcpLog("single_completed");
  return Response.json(response, {
    headers: {
      "MCP-Protocol-Version": "2025-03-26",
    },
  });
}
