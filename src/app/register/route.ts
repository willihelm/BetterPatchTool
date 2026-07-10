import { api } from "../../../convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";

const MAX_BODY_BYTES = 10_000;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  return new ConvexHttpClient(url);
}

function registrationError(error: string, description: string, status = 400) {
  return Response.json(
    { error, error_description: description },
    { status, headers: { "Cache-Control": "no-store", ...CORS_HEADERS } }
  );
}

function asOptionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function asOptionalStringArray(value: unknown) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) return null;
  return value as string[];
}

// Open Dynamic Client Registration endpoint (RFC 7591). MCP clients such as
// Claude self-register here before starting the authorization flow.
export async function POST(request: Request) {
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    return registrationError("invalid_client_metadata", "Request body too large");
  }

  let metadata: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    metadata = parsed as Record<string, unknown>;
  } catch {
    return registrationError("invalid_client_metadata", "Request body must be a JSON object");
  }

  const redirectUris = asOptionalStringArray(metadata.redirect_uris);
  if (!redirectUris) {
    return registrationError("invalid_redirect_uri", "redirect_uris must be an array of strings");
  }
  const grantTypes = asOptionalStringArray(metadata.grant_types);
  if (grantTypes === null) {
    return registrationError("invalid_client_metadata", "grant_types must be an array of strings");
  }

  const convex = getConvexClient();
  if (!convex) {
    return registrationError("server_error", "Registration endpoint is not configured", 500);
  }

  try {
    const registered = await convex.mutation(api.mcpOAuthClients.register, {
      clientName: asOptionalString(metadata.client_name),
      redirectUris,
      tokenEndpointAuthMethod: asOptionalString(metadata.token_endpoint_auth_method),
      grantTypes,
      clientUri: asOptionalString(metadata.client_uri),
      logoUri: asOptionalString(metadata.logo_uri),
    });

    return Response.json(
      {
        client_id: registered.clientId,
        client_id_issued_at: registered.clientIdIssuedAt,
        redirect_uris: registered.redirectUris,
        token_endpoint_auth_method: registered.tokenEndpointAuthMethod,
        grant_types: registered.grantTypes,
        response_types: ["code"],
        ...(registered.clientName ? { client_name: registered.clientName } : {}),
        ...(registered.clientUri ? { client_uri: registered.clientUri } : {}),
        ...(registered.logoUri ? { logo_uri: registered.logoUri } : {}),
      },
      { status: 201, headers: { "Cache-Control": "no-store", ...CORS_HEADERS } }
    );
  } catch (error) {
    const message =
      error instanceof ConvexError && typeof error.data === "string"
        ? error.data
        : error instanceof Error
          ? error.message
          : "Unknown error";
    if (message.includes("invalid_redirect_uri")) {
      return registrationError("invalid_redirect_uri", message);
    }
    if (message.includes("invalid_client_metadata")) {
      return registrationError("invalid_client_metadata", message);
    }
    return registrationError("server_error", "Client registration failed", 500);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
