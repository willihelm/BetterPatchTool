import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { z } from "zod";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { api } from "../../../../convex/_generated/api";
import { mcpToolDefinitions } from "../../../../convex/_helpers/mcpToolSchemas";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, WWW-Authenticate",
  "Access-Control-Max-Age": "86400",
};

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  return new ConvexHttpClient(url);
}

function parseMcpError(error: unknown): { kind: string; message: string } {
  // ConvexError.data carries the code through prod deployments, where plain
  // error messages are redacted to "Server Error".
  const message =
    error instanceof ConvexError && typeof error.data === "string"
      ? error.data
      : error instanceof Error
        ? error.message
        : "Unknown error";
  const match = /^MCP_ERROR:(unauthorized|forbidden|invalid_arguments|not_found):([\s\S]*)$/.exec(message);
  if (!match) return { kind: "internal", message };
  return { kind: match[1], message: match[2].trim() };
}

function toolErrorResult(kind: string, message: string) {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: `${kind}: ${message}` }],
  };
}

const handler = createMcpHandler(
  (server) => {
    const toolEntries = Object.entries(mcpToolDefinitions) as Array<
      [string, { description: string; inputShape: z.ZodRawShape }]
    >;
    for (const [name, definition] of toolEntries) {
      server.tool(
        name,
        definition.description,
        definition.inputShape,
        async (args: Record<string, unknown>, extra: { authInfo?: AuthInfo }) => {
          const accessToken = extra.authInfo?.token;
          if (!accessToken) {
            return toolErrorResult("unauthorized", "Missing bearer token");
          }
          const convex = getConvexClient();
          if (!convex) {
            return toolErrorResult("internal", "MCP endpoint is not configured");
          }
          try {
            // The trust boundary stays in Convex: the mutation re-validates the
            // token (including audience) before executing the tool.
            const result = await convex.mutation(api.mcp.executeToolWithOAuthAccessToken, {
              accessToken,
              name,
              args: args ?? {},
            });
            return {
              content: [{ type: "text" as const, text: JSON.stringify(result) }],
            };
          } catch (error) {
            const parsed = parseMcpError(error);
            if (parsed.kind === "internal") {
              return toolErrorResult("internal", "Internal error");
            }
            return toolErrorResult(parsed.kind, parsed.message);
          }
        }
      );
    }
  },
  {
    serverInfo: {
      name: "betterpatchtool-mcp",
      version: "2.0.0",
    },
  },
  {
    basePath: "/api",
    disableSse: true,
    maxDuration: 60,
  }
);

const verifyToken = async (req: Request, bearerToken?: string): Promise<AuthInfo | undefined> => {
  if (!bearerToken) return undefined;
  const convex = getConvexClient();
  if (!convex) return undefined;

  const validated = await convex.query(api.mcpOAuth.validateAccessToken, {
    accessToken: bearerToken,
  });
  if (!validated) return undefined;

  return {
    token: bearerToken,
    clientId: validated.clientId,
    scopes: validated.scope ? validated.scope.split(" ") : [],
    expiresAt: Math.floor(validated.expiresAt / 1000),
    extra: { userId: validated.userId },
  };
};

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  resourceUrl: process.env.NEXT_PUBLIC_APP_URL,
});

async function corsWrappedHandler(request: Request) {
  const response = await authHandler(request);
  for (const [header, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(header, value);
  }
  return response;
}

function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export { corsWrappedHandler as GET, corsWrappedHandler as POST, corsWrappedHandler as DELETE, OPTIONS };
