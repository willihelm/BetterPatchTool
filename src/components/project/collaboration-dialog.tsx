"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Copy } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import type { ProjectCollaborator, ProjectShareLink } from "@/types/convex";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export function CollaborationDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: Id<"projects">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const collaborators = useQuery(api.collaboration.listCollaborators, { projectId }) as
    | ProjectCollaborator[]
    | undefined;
  const shareLinks = useQuery(api.collaboration.listShareLinks, { projectId }) as
    | ProjectShareLink[]
    | undefined;
  const inviteCollaborator = useMutation(api.collaboration.inviteCollaborator);
  const updateRole = useMutation(api.collaboration.updateCollaboratorRole);
  const removeCollaborator = useMutation(api.collaboration.removeCollaborator);
  const createShareLink = useMutation(api.collaboration.createShareLink);
  const revokeShareLink = useMutation(api.collaboration.revokeShareLink);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("editor");
  const [shareLabel, setShareLabel] = useState("Public read-only");
  const [latestLink, setLatestLink] = useState<string | null>(null);
  const [copiedShareLinkId, setCopiedShareLinkId] = useState<string | null>(null);

  const buildShareUrl = (token: string) => `${window.location.origin}/shared/${token}`;

  const copyShareLink = async (shareLink: Pick<ProjectShareLink, "_id" | "token">) => {
    if (!shareLink.token) return;
    const url = buildShareUrl(shareLink.token);
    await navigator.clipboard.writeText(url);
    setLatestLink(url);
    setCopiedShareLinkId(shareLink._id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Collaboration</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Invite Collaborator</h3>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(value: "viewer" | "editor") => setRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={async () => {
                if (!email.trim()) return;
                await inviteCollaborator({ projectId, email, role });
                setEmail("");
              }}
            >
              Send Invite
            </Button>

            <div className="space-y-2">
              {(collaborators ?? []).map((collaborator) => (
                <div key={collaborator._id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{collaborator.displayName}</div>
                      {collaborator.email && (
                        <div className="text-xs text-muted-foreground">{collaborator.email}</div>
                      )}
                    </div>
                    <Badge variant="outline">{collaborator.role}</Badge>
                  </div>
                  {!collaborator.isOwner && (
                    <div className="mt-3 flex gap-2">
                      <Select
                        value={collaborator.role}
                        onValueChange={(value: "viewer" | "editor") =>
                          updateRole({ collaboratorId: collaborator._id as Id<"projectCollaborators">, role: value })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          removeCollaborator({ collaboratorId: collaborator._id as Id<"projectCollaborators"> })
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {collaborators !== undefined && collaborators.length === 0 && (
                <p className="text-sm text-muted-foreground">No collaborators yet.</p>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium">Public Share Links</h3>
            <div className="space-y-2">
              <Label htmlFor="share-label">Label</Label>
              <Input id="share-label" value={shareLabel} onChange={(e) => setShareLabel(e.target.value)} />
            </div>
            <Button
              variant="outline"
              onClick={async () => {
                const result = await createShareLink({ projectId, label: shareLabel });
                const url = buildShareUrl(result.token);
                setLatestLink(url);
                setCopiedShareLinkId(result.shareLinkId);
                await navigator.clipboard.writeText(url);
              }}
            >
              Create Share Link
            </Button>
            {latestLink && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                <div className="font-medium text-emerald-200">Link copied to clipboard</div>
                <div className="mt-2 break-all rounded-md bg-black/20 px-3 py-2 font-mono text-xs text-emerald-50">
                  {latestLink}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {(shareLinks ?? []).map((shareLink) => (
                <div key={shareLink._id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{shareLink.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {shareLink.isRevoked ? "Revoked" : "Active"}
                      </div>
                    </div>
                    {!shareLink.isRevoked && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyShareLink(shareLink)}
                          disabled={!shareLink.token}
                        >
                          <Copy />
                          {copiedShareLinkId === shareLink._id ? "Copied" : "Copy Link"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => revokeShareLink({ shareLinkId: shareLink._id as Id<"projectShareLinks"> })}
                        >
                          Revoke
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {shareLinks !== undefined && shareLinks.length === 0 && (
                <p className="text-sm text-muted-foreground">No share links yet.</p>
              )}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
