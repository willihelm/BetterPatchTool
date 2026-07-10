import { redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConsentContent } from "./consent-content";

export const dynamic = "force-dynamic";

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  return new ConvexHttpClient(url);
}

function getIssuer(requestFallback?: string) {
  return process.env.NEXT_PUBLIC_APP_URL ?? requestFallback ?? "";
}

// Rendered (never redirected to) when client_id / redirect_uri cannot be
// trusted — per OAuth 2.1 those errors must not be sent to the redirect URI.
function AuthorizationErrorPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Close this window and retry the connection from your MCP client.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function buildErrorRedirect(
  redirectUri: string,
  error: string,
  state: string | undefined,
  issuer: string,
  description?: string
) {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  if (description) url.searchParams.set("error_description", description);
  if (state) url.searchParams.set("state", state);
  if (issuer) url.searchParams.set("iss", issuer);
  return url.toString();
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const responseType = first(params.response_type);
  const clientId = first(params.client_id);
  const redirectUri = first(params.redirect_uri);
  const state = first(params.state);
  const codeChallenge = first(params.code_challenge);
  const codeChallengeMethod = first(params.code_challenge_method) ?? "plain";
  const scope = first(params.scope);
  const resource = first(params.resource);

  const issuer = getIssuer();

  if (!clientId) {
    return (
      <AuthorizationErrorPage
        title="Invalid authorization request"
        description="The request is missing a client_id parameter."
      />
    );
  }

  const convex = getConvexClient();
  if (!convex) {
    return (
      <AuthorizationErrorPage
        title="Authorization unavailable"
        description="The OAuth authorization server is not configured."
      />
    );
  }

  const client = await convex.query(api.mcpOAuthClients.getByClientId, { clientId });
  if (!client) {
    return (
      <AuthorizationErrorPage
        title="Unknown application"
        description="This application is not registered. It may need to re-register before connecting."
      />
    );
  }

  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    return (
      <AuthorizationErrorPage
        title="Invalid redirect URI"
        description="The redirect_uri does not match any URI registered by this application."
      />
    );
  }

  // client_id and redirect_uri are trusted from here on; remaining validation
  // errors are returned to the client via the redirect URI (with RFC 9207 iss).
  if (responseType !== "code") {
    redirect(buildErrorRedirect(redirectUri, "unsupported_response_type", state, issuer, "response_type must be code"));
  }
  if (!codeChallenge) {
    redirect(buildErrorRedirect(redirectUri, "invalid_request", state, issuer, "code_challenge is required (PKCE)"));
  }
  if (codeChallengeMethod !== "S256") {
    redirect(buildErrorRedirect(redirectUri, "invalid_request", state, issuer, "code_challenge_method must be S256"));
  }

  return (
    <ConsentContent
      clientId={clientId}
      clientName={client.clientName ?? null}
      clientUri={client.clientUri ?? null}
      redirectUri={redirectUri}
      state={state ?? null}
      codeChallenge={codeChallenge}
      scope={scope ?? null}
      resource={resource ?? null}
      issuer={issuer}
    />
  );
}
