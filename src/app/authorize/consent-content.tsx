"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type ConsentContentProps = {
  clientId: string;
  clientName: string | null;
  clientUri: string | null;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  scope: string | null;
  resource: string | null;
  issuer: string;
};

function appendAuthorizationResponseParams(url: URL, state: string | null, issuer: string) {
  if (state) url.searchParams.set("state", state);
  if (issuer) url.searchParams.set("iss", issuer);
  return url;
}

export function ConsentContent({
  clientId,
  clientName,
  clientUri,
  redirectUri,
  state,
  codeChallenge,
  scope,
  resource,
  issuer,
}: ConsentContentProps) {
  const createAuthorizationCode = useMutation(api.mcpOAuth.createAuthorizationCode);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const displayName = clientName?.trim() || "An MCP application";
  const redirectHost = React.useMemo(() => {
    try {
      return new URL(redirectUri).host;
    } catch {
      return redirectUri;
    }
  }, [redirectUri]);

  const buildErrorUrl = (error: string, description?: string) => {
    const callback = new URL(redirectUri);
    callback.searchParams.set("error", error);
    if (description) callback.searchParams.set("error_description", description);
    appendAuthorizationResponseParams(callback, state, issuer);
    return callback.toString();
  };

  const onApprove = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const created = await createAuthorizationCode({
        clientId,
        redirectUri,
        codeChallenge,
        codeChallengeMethod: "S256",
        scope: scope ?? undefined,
        resource: resource ?? undefined,
      });
      const callback = new URL(redirectUri);
      callback.searchParams.set("code", created.code);
      appendAuthorizationResponseParams(callback, state, issuer);
      window.location.assign(callback.toString());
    } catch (error) {
      const message =
        error instanceof ConvexError && typeof error.data === "string"
          ? error.data
          : error instanceof Error
            ? error.message
            : "Unknown error";
      if (message.includes("invalid resource")) {
        const callback = buildErrorUrl("invalid_target", message);
        window.location.assign(callback);
        return;
      }
      setErrorMessage(message);
      setIsSubmitting(false);
    }
  };

  const onDeny = () => {
    window.location.assign(buildErrorUrl("access_denied", "The user denied the authorization request"));
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Connect {displayName}?</CardTitle>
          <CardDescription>
            {displayName} wants to access your BetterPatchTool account via MCP.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <p className="font-medium">This will allow the application to:</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>List and read your projects, channels, and IO devices</li>
              <li>Update project details and patch data where you have editor access</li>
            </ul>
            {scope && (
              <p className="text-xs text-muted-foreground">
                Requested scope: <code>{scope}</code>
              </p>
            )}
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            {clientUri && <p>Application URL: {clientUri}</p>}
            <p>After approval you will be sent back to {redirectHost}.</p>
            <p>You can revoke access at any time under Settings → Connected apps.</p>
          </div>
          {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={onDeny} disabled={isSubmitting}>
            Deny
          </Button>
          <Button onClick={() => void onApprove()} disabled={isSubmitting}>
            {isSubmitting ? "Connecting…" : "Approve"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
