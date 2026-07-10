"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { AppHeader } from "@/components/shared/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

type Grant = {
  clientId: string;
  clientName?: string;
  clientUri?: string;
  connectedAt: number;
  lastUsedAt?: number;
  scope?: string;
};

function formatDate(value?: number) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

export function McpAccessContent() {
  const grants = useQuery(api.mcpOAuth.listGrants, {}) as Grant[] | undefined;
  const revokeGrant = useMutation(api.mcpOAuth.revokeClientGrant);

  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [infoMessage, setInfoMessage] = React.useState<string | null>(null);
  const [revokingClientId, setRevokingClientId] = React.useState<string | null>(null);

  const onRevoke = async (grant: Grant) => {
    const label = grant.clientName ?? grant.clientId;
    if (!window.confirm(`Revoke access for "${label}"? The app will have to be re-authorized to connect again.`)) {
      return;
    }
    setErrorMessage(null);
    setInfoMessage(null);
    setRevokingClientId(grant.clientId);
    try {
      await revokeGrant({ clientId: grant.clientId });
      setInfoMessage(`Access for "${label}" has been revoked.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to revoke access");
    } finally {
      setRevokingClientId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        actions={
          <Button variant="outline" asChild>
            <Link href="/dashboard">Back to Projects</Link>
          </Button>
        }
      />

      <main className="container mx-auto space-y-6 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Connected apps</CardTitle>
            <CardDescription>
              MCP applications (e.g. Claude) that you have authorized to access your account. Revoking an app
              invalidates all of its tokens immediately.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
            {infoMessage && <p className="text-sm text-muted-foreground">{infoMessage}</p>}
            {grants === undefined ? (
              <p className="text-sm text-muted-foreground">Loading connected apps...</p>
            ) : grants.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No connected apps yet. Add this server as a custom connector in Claude to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {grants.map((grant) => (
                  <div key={grant.clientId} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{grant.clientName ?? "Unnamed application"}</p>
                        {grant.clientUri && (
                          <p className="text-xs text-muted-foreground">URL: {grant.clientUri}</p>
                        )}
                        <p className="text-xs text-muted-foreground">Connected: {formatDate(grant.connectedAt)}</p>
                        <p className="text-xs text-muted-foreground">Last used: {formatDate(grant.lastUsedAt)}</p>
                        {grant.scope && (
                          <p className="text-xs text-muted-foreground">Scope: {grant.scope}</p>
                        )}
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void onRevoke(grant)}
                        disabled={revokingClientId === grant.clientId}
                      >
                        Revoke
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How to connect</CardTitle>
            <CardDescription>Connect Claude (or any MCP client) via OAuth - no keys to copy.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <ol className="list-decimal space-y-1 pl-5">
              <li>In Claude, open Settings → Connectors → Add custom connector.</li>
              <li>
                Paste this server&apos;s MCP URL: <code>{`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/mcp`}</code>
              </li>
              <li>Sign in with GitHub and approve the consent screen.</li>
            </ol>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
