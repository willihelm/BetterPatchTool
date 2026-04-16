import { api } from "../../../convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  return new ConvexHttpClient(url);
}

function buildOAuthErrorRedirect(redirectUri: string, error: string, state?: string | null, description?: string) {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  if (state) {
    url.searchParams.set("state", state);
  }
  if (description) {
    url.searchParams.set("error_description", description);
  }
  return url;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const responseType = url.searchParams.get("response_type");
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state");
  const codeChallenge = url.searchParams.get("code_challenge");
  const codeChallengeMethod = url.searchParams.get("code_challenge_method") ?? "plain";
  const scope = url.searchParams.get("scope") ?? undefined;

  if (!redirectUri) {
    return Response.json({ error: "invalid_request", error_description: "redirect_uri is required" }, { status: 400 });
  }

  if (
    responseType !== "code" ||
    !clientId ||
    !codeChallenge ||
    (codeChallengeMethod !== "S256" && codeChallengeMethod !== "plain")
  ) {
    return Response.redirect(
      buildOAuthErrorRedirect(redirectUri, "invalid_request", state, "Missing or invalid OAuth parameters"),
      302
    );
  }

  const sessionToken = await convexAuthNextjsToken();
  if (!sessionToken) {
    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set("redirectTo", `${url.pathname}${url.search}`);
    return Response.redirect(loginUrl, 302);
  }

  const convex = getConvexClient();
  if (!convex) {
    return Response.redirect(buildOAuthErrorRedirect(redirectUri, "server_error", state, "MCP OAuth unavailable"), 302);
  }

  try {
    convex.setAuth(sessionToken);
    const created = await convex.mutation(api.mcpOAuth.createAuthorizationCode, {
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod: codeChallengeMethod as "S256" | "plain",
      scope,
    });

    const callback = new URL(redirectUri);
    callback.searchParams.set("code", created.code);
    if (state) {
      callback.searchParams.set("state", state);
    }
    return Response.redirect(callback, 302);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const oauthError = message.includes("invalid client")
      ? "unauthorized_client"
      : message.includes("invalid redirect_uri")
        ? "invalid_request"
        : message.includes("unauthorized")
          ? "access_denied"
          : "server_error";

    return Response.redirect(buildOAuthErrorRedirect(redirectUri, oauthError, state, message), 302);
  }
}
