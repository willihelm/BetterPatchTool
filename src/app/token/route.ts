import { api } from "../../../convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const RESPONSE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
  Pragma: "no-cache",
  ...CORS_HEADERS,
};

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  return new ConvexHttpClient(url);
}

function tokenError(error: string, description: string, status = 400) {
  return Response.json(
    {
      error,
      error_description: description,
    },
    {
      status,
      headers: RESPONSE_HEADERS,
    }
  );
}

type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  scope?: string;
};

function tokenSuccess(issued: IssuedTokens) {
  return Response.json(
    {
      access_token: issued.accessToken,
      refresh_token: issued.refreshToken,
      token_type: issued.tokenType,
      expires_in: issued.expiresIn,
      ...(issued.scope ? { scope: issued.scope } : {}),
    },
    { headers: RESPONSE_HEADERS }
  );
}

function mapOAuthError(error: unknown) {
  // ConvexError.data carries the code through prod deployments, where plain
  // error messages are redacted to "Server Error".
  const message =
    error instanceof ConvexError && typeof error.data === "string"
      ? error.data
      : error instanceof Error
        ? error.message
        : "Unknown error";
  if (message.includes("invalid client")) {
    return tokenError("invalid_client", message, 401);
  }
  if (
    message.includes("invalid code") ||
    message.includes("invalid code_verifier") ||
    message.includes("invalid refresh_token")
  ) {
    return tokenError("invalid_grant", message);
  }
  if (message.includes("unsupported grant_type")) {
    return tokenError("unsupported_grant_type", message);
  }
  if (message.includes("invalid redirect_uri")) {
    return tokenError("invalid_request", message);
  }
  if (message.includes("invalid resource")) {
    return tokenError("invalid_target", message);
  }
  return tokenError("server_error", message, 500);
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return tokenError("invalid_request", "Content-Type must be application/x-www-form-urlencoded");
  }

  const form = await request.formData();
  const grantType = String(form.get("grant_type") ?? "");
  const clientId = String(form.get("client_id") ?? "");

  const convex = getConvexClient();
  if (!convex) {
    return tokenError("server_error", "MCP OAuth endpoint is not configured", 500);
  }

  if (grantType === "authorization_code") {
    const code = String(form.get("code") ?? "");
    const redirectUri = String(form.get("redirect_uri") ?? "");
    const codeVerifier = String(form.get("code_verifier") ?? "");
    const resourceValue = form.get("resource");
    const resource = resourceValue === null ? undefined : String(resourceValue);

    if (!clientId || !code || !redirectUri || !codeVerifier) {
      return tokenError("invalid_request", "Missing OAuth token request parameters");
    }

    try {
      const issued = await convex.mutation(api.mcpOAuth.exchangeAuthorizationCode, {
        grantType,
        clientId,
        code,
        redirectUri,
        codeVerifier,
        resource,
      });
      return tokenSuccess(issued);
    } catch (error) {
      return mapOAuthError(error);
    }
  }

  if (grantType === "refresh_token") {
    const refreshToken = String(form.get("refresh_token") ?? "");
    if (!clientId || !refreshToken) {
      return tokenError("invalid_request", "Missing OAuth token request parameters");
    }

    try {
      const issued = await convex.mutation(api.mcpOAuth.refreshAccessToken, {
        grantType,
        clientId,
        refreshToken,
      });
      // Refresh-token reuse is reported as a value so the family revocation
      // commits (a thrown Convex error would roll it back).
      if ("error" in issued) {
        return tokenError(issued.error, issued.errorDescription);
      }
      return tokenSuccess(issued);
    } catch (error) {
      return mapOAuthError(error);
    }
  }

  return tokenError("unsupported_grant_type", `Unsupported grant_type "${grantType}"`);
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
