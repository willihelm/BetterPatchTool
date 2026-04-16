import { api } from "../../../convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";

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
      headers: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      },
    }
  );
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return tokenError("invalid_request", "Content-Type must be application/x-www-form-urlencoded");
  }

  const form = await request.formData();
  const grantType = String(form.get("grant_type") ?? "");
  const clientId = String(form.get("client_id") ?? "");
  const clientSecretValue = form.get("client_secret");
  const clientSecret = clientSecretValue === null ? undefined : String(clientSecretValue);
  const code = String(form.get("code") ?? "");
  const redirectUri = String(form.get("redirect_uri") ?? "");
  const codeVerifier = String(form.get("code_verifier") ?? "");

  if (!grantType || !clientId || !code || !redirectUri || !codeVerifier) {
    return tokenError("invalid_request", "Missing OAuth token request parameters");
  }

  const convex = getConvexClient();
  if (!convex) {
    return tokenError("server_error", "MCP OAuth endpoint is not configured", 500);
  }

  try {
    const exchanged = await convex.mutation(api.mcpOAuth.exchangeAuthorizationCode, {
      grantType,
      clientId,
      clientSecret,
      code,
      redirectUri,
      codeVerifier,
    });

    return Response.json(
      {
        access_token: exchanged.accessToken,
        token_type: exchanged.tokenType,
        expires_in: exchanged.expiresIn,
        ...(exchanged.scope ? { scope: exchanged.scope } : {}),
      },
      {
        headers: {
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("invalid client")) {
      return tokenError("invalid_client", message, 401);
    }
    if (message.includes("invalid code") || message.includes("invalid code_verifier")) {
      return tokenError("invalid_grant", message);
    }
    if (message.includes("unsupported grant_type")) {
      return tokenError("unsupported_grant_type", message);
    }
    if (message.includes("invalid redirect_uri")) {
      return tokenError("invalid_request", message);
    }
    return tokenError("server_error", message, 500);
  }
}
