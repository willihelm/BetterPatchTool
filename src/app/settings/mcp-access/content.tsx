"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { AppHeader } from "@/components/shared/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";

type CredentialRow = {
  _id: Id<"mcpCredentials">;
  name: string;
  clientId: string;
  createdAt: number;
  lastUsedAt?: number;
};

function formatDate(value?: number) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

export function McpAccessContent() {
  const credentials = useQuery(api.mcpCredentials.list, {}) as CredentialRow[] | undefined;
  const createCredential = useMutation(api.mcpCredentials.create);
  const deleteCredential = useMutation(api.mcpCredentials.remove);

  const [name, setName] = React.useState("");
  const [createdClientId, setCreatedClientId] = React.useState<string | null>(null);
  const [createdClientSecret, setCreatedClientSecret] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [infoMessage, setInfoMessage] = React.useState<string | null>(null);

  const onCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      const result = await createCredential({ name: trimmed });
      setCreatedClientId(result.clientId);
      setCreatedClientSecret(result.clientSecret);
      setName("");
      setInfoMessage("Credential created. Copy the secret now - it will not be shown again.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create credential");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDelete = async (credentialId: Id<"mcpCredentials">) => {
    if (!window.confirm("Delete this credential? This cannot be undone.")) {
      return;
    }
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      await deleteCredential({ credentialId });
      setInfoMessage("Credential deleted.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete credential");
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
            <CardTitle>MCP Client Credentials</CardTitle>
            <CardDescription>
              Create `client_id` and `client_secret` for MCP clients (e.g. Claude Code). The secret is shown only once.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
            {infoMessage && <p className="text-sm text-muted-foreground">{infoMessage}</p>}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Label (e.g. Claude Code)"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <Button onClick={() => void onCreate()} disabled={isSubmitting || !name.trim()}>
                Create credentials
              </Button>
            </div>

            {createdClientId && createdClientSecret && (
              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                <p className="text-sm font-medium">
                  Copy now - the secret will not be shown again:
                </p>
                <div>
                  <p className="text-xs text-muted-foreground">Client ID</p>
                  <pre className="overflow-x-auto text-xs">{createdClientId}</pre>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Client Secret</p>
                  <pre className="overflow-x-auto text-xs">{createdClientSecret}</pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Existing credentials</CardTitle>
          </CardHeader>
          <CardContent>
            {credentials === undefined ? (
              <p className="text-sm text-muted-foreground">Loading credentials...</p>
            ) : credentials.length === 0 ? (
              <p className="text-sm text-muted-foreground">No credentials yet.</p>
            ) : (
              <div className="space-y-3">
                {credentials.map((credential) => (
                  <div key={credential._id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{credential.name}</p>
                        <p className="text-xs text-muted-foreground">Client ID: {credential.clientId}</p>
                        <p className="text-xs text-muted-foreground">
                          Created: {formatDate(credential.createdAt)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Last used: {formatDate(credential.lastUsedAt)}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void onDelete(credential._id)}
                      >
                        Delete
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
            <CardTitle>MCP usage (Client ID/Secret)</CardTitle>
            <CardDescription>
              You can use MCP either with an OAuth session/bearer token or with the client credentials created here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              <span className="font-medium">Endpoint:</span> <code>POST /api/mcp</code>
            </p>
            <p>
              <span className="font-medium">HTTP Auth:</span>{" "}
              <code>Authorization: Basic base64(client_id:client_secret)</code>
            </p>
            <pre className="overflow-x-auto rounded-md border bg-muted/30 p-2 text-xs">
              <code>{`curl -X POST http://localhost:3000/api/mcp \\
  -H "Content-Type: application/json" \\
  -u "<client_id>:<client_secret>" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`}</code>
            </pre>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
