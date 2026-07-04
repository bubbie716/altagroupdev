"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatUserTag } from "@/lib/auth/tags";
import type { UserTag } from "@/lib/auth/types";
import {
  grantInternalUserTagRecord,
  revokeInternalUserTagRecord,
} from "@/lib/internal/user-management.functions";
import type { InternalUserDetail } from "@/lib/internal/user-management.types";
import { ALL_USER_TAGS } from "@/lib/internal/user-management.types";

type PendingAction = {
  kind: "grant" | "revoke";
  tag: UserTag;
};

export function InternalUserTagPanel({ user }: { user: InternalUserDetail }) {
  const router = useRouter();
  const grantTag = useServerFn(grantInternalUserTagRecord);
  const revokeTag = useServerFn(revokeInternalUserTagRecord);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function runAction(action: PendingAction) {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      if (action.kind === "grant") {
        await grantTag({ data: { userId: user.id, tag: action.tag } });
        setMessage(`${formatUserTag(action.tag)} granted.`);
      } else {
        await revokeTag({
          data: {
            userId: user.id,
            tag: action.tag,
            reason: action.tag === "private_client" ? revokeReason : undefined,
          },
        });
        setMessage(`${formatUserTag(action.tag)} revoked.`);
      }
      setPending(null);
      setRevokeReason("");
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Action failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function requestAction(kind: PendingAction["kind"], tag: UserTag) {
    const action = user.capabilities.tags[tag];
    if (kind === "grant" && !action.canGrant) return;
    if (kind === "revoke" && !action.canRevoke) return;

    const needsConfirm =
      (tag === "admin" && (kind === "grant" || kind === "revoke")) ||
      (tag === "operator" && kind === "revoke") ||
      (tag === "private_client" && (kind === "grant" || kind === "revoke"));

    if (needsConfirm) {
      setRevokeReason("");
      setPending({ kind, tag });
      return;
    }

    void runAction({ kind, tag });
  }

  return (
    <>
      <div className="space-y-4">
        <p className="text-[13px] text-muted-foreground">
          Global Alta access tags. Staff tags (Admin, Operator) require admin privileges to modify.
        </p>

        <div className="space-y-3">
          {ALL_USER_TAGS.map((tag) => {
            const active = user.tags.includes(tag);
            const action = user.capabilities.tags[tag];
            const isStaff = tag === "admin" || tag === "operator";

            return (
              <div
                key={tag}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3 ${
                  isStaff
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-border/60 bg-surface-2/20"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    {isStaff && <AlertTriangle className="size-3.5 text-destructive" aria-hidden />}
                    <span className="font-medium">{formatUserTag(tag)}</span>
                    <span
                      className={`font-mono text-[10px] uppercase tracking-[0.14em] ${
                        active ? "text-[var(--success)]" : "text-muted-foreground"
                      }`}
                    >
                      {active ? "Active" : "Not assigned"}
                    </span>
                  </div>
                  {tag === "admin" && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Full internal access and tag management.
                    </p>
                  )}
                  {tag === "operator" && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Internal console access without staff tag management.
                    </p>
                  )}
                  {tag === "private_client" && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Alta Private membership is invitation-only. Use the Relationship tab to send invitations; admins may override here in exceptional cases.
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {action.canGrant && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => requestAction("grant", tag)}
                      className="rounded-md border border-border-strong bg-surface-2 px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-surface-2/80 disabled:opacity-50"
                    >
                      Grant
                    </button>
                  )}
                  {action.canRevoke && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => requestAction("revoke", tag)}
                      className="rounded-md border border-destructive/40 px-3 py-1.5 text-[12px] font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  )}
                  {!action.canGrant && !action.canRevoke && (
                    <span className="text-[11px] text-muted-foreground">No access</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {message && <p className="text-[13px] text-[var(--success)]">{message}</p>}
        {error && <p className="text-[13px] text-destructive">{error}</p>}
        <p className="text-[11px] text-muted-foreground">
          {/* TODO: Future AuditLog required for tag changes. */}
          Tag changes are applied immediately. Audit logging is planned for a future release.
        </p>
      </div>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Confirm {pending?.kind === "grant" ? "grant" : "revoke"} {pending ? formatUserTag(pending.tag) : ""}
            </DialogTitle>
            <DialogDescription>
              {pending?.tag === "admin"
                ? "Admin access grants full internal control including tag management. Confirm only for trusted staff."
                : pending?.tag === "private_client"
                  ? "Direct Alta Private membership changes bypass the invitation flow. Use only for exceptional admin overrides."
                  : pending?.tag === "operator" && pending.kind === "revoke"
                  ? "Revoking operator access removes internal console access for this user."
                  : "This change takes effect immediately."}
            </DialogDescription>
          </DialogHeader>
          {pending?.kind === "revoke" && pending.tag === "private_client" && (
            <label className="block space-y-2">
              <span className="text-[12px] font-medium text-foreground">Revocation reason</span>
              <textarea
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
                placeholder="Document why Alta Private access is being removed."
              />
            </label>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => {
                setPending(null);
                setRevokeReason("");
              }}
              className="rounded-md border border-border px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                submitting ||
                !pending ||
                (pending.kind === "revoke" &&
                  pending.tag === "private_client" &&
                  revokeReason.trim().length < 5)
              }
              onClick={() => pending && void runAction(pending)}
              className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive disabled:opacity-50"
            >
              {submitting ? "Applying…" : "Confirm"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
