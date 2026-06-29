"use client";

import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { AltaPrivateInternalSummary } from "@/lib/bank/alta-private-types";
import {
  revokeAltaPrivateInvitationRecord,
  sendAltaPrivateInvitationRecord,
} from "@/lib/bank/alta-private.functions";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";

export function AltaPrivateAdminPanel({
  userId,
  summary,
  canManageInvitations,
}: {
  userId: string;
  summary: AltaPrivateInternalSummary;
  canManageInvitations: boolean;
}) {
  const router = useRouter();
  const sendInvitation = useServerFn(sendAltaPrivateInvitationRecord);
  const revokeInvitation = useServerFn(revokeAltaPrivateInvitationRecord);
  const [message, setMessage] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  async function handleSend() {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await sendInvitation({ data: { userId, invitationMessage: message } });
      setSuccess("Alta Private invitation sent.");
      setMessage("");
      setConfirmSend(false);
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Unable to send invitation.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke() {
    if (!summary.pendingInvitation) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await revokeInvitation({
        data: { invitationId: summary.pendingInvitation.id, reason: revokeReason },
      });
      setSuccess("Invitation revoked.");
      setRevokeReason("");
      setConfirmRevoke(false);
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Unable to revoke invitation.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-xl border border-gold/30 bg-gold/5 p-5">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Alta Private — membership & invitations
      </h3>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-[14px]">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Alta Private status</dt>
          <dd className="mt-1 font-medium">
            {summary.membershipActive ? "Active membership" : "Not a member"}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Eligibility</dt>
          <dd className="mt-1 font-medium">{summary.eligible ? "Eligible" : "Not eligible"}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Active invitation</dt>
          <dd className="mt-1 font-medium">
            {summary.pendingInvitation ? (
              <OpsStatusBadge status="Pending invitation" dot={false} />
            ) : (
              "None"
            )}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Audit</dt>
          <dd className="mt-1">
            <Link
              to="/internal/users/$userId"
              params={{ userId }}
              search={{ tab: "audit" }}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline"
            >
              View audit log →
            </Link>
          </dd>
        </div>
      </dl>

      {canManageInvitations && !summary.membershipActive ? (
        <div className="mt-5 space-y-3 rounded-lg border border-border/60 bg-surface-1/80 p-4">
          <p className="text-[13px] text-muted-foreground">
            Send an Alta Private invitation after relationship review. The customer must accept before membership activates.
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Invitation message (required) — explain why Alta Private is being extended."
            className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-[13px]"
          />
          {!confirmSend ? (
            <button
              type="button"
              disabled={message.trim().length < 10}
              onClick={() => setConfirmSend(true)}
              className="rounded-md border border-gold/40 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:bg-gold/10 disabled:opacity-50"
            >
              Send Alta Private Invitation
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSend()}
                className="rounded-md border border-gold/40 bg-gold/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-gold disabled:opacity-50"
              >
                {submitting ? "Sending…" : "Confirm send invitation"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmSend(false)}
                className="rounded-md border border-border px-4 py-2 text-[12px]"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      ) : null}

      {canManageInvitations && summary.pendingInvitation ? (
        <div className="mt-4 space-y-3 rounded-lg border border-border/60 bg-surface-1/80 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Pending invitation · sent {formatActivityDateTime(summary.pendingInvitation.createdAt)}
          </p>
          {!confirmRevoke ? (
            <button
              type="button"
              onClick={() => setConfirmRevoke(true)}
              className="rounded-md border border-destructive/40 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-destructive hover:bg-destructive/10"
            >
              Revoke Invitation
            </button>
          ) : (
            <div className="space-y-2">
              <input
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Revocation reason (required)"
                className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-[13px]"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={submitting || revokeReason.trim().length < 5}
                  onClick={() => void handleRevoke()}
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-destructive disabled:opacity-50"
                >
                  {submitting ? "Revoking…" : "Confirm revoke"}
                </button>
                <button type="button" onClick={() => setConfirmRevoke(false)} className="rounded-md border border-border px-4 py-2 text-[12px]">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {summary.invitationHistory.length > 0 ? (
        <div className="mt-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Invitation history</p>
          <ul className="mt-3 space-y-2">
            {summary.invitationHistory.map((row) => (
              <li key={row.id} className="rounded-md border border-border/60 px-3 py-2 text-[12px]">
                <span className="font-medium capitalize">{row.status}</span>
                {" · "}
                {formatActivityDateTime(row.createdAt)}
                {row.acceptedAt ? ` · accepted ${formatActivityDateTime(row.acceptedAt)}` : null}
                {row.declinedAt ? ` · declined ${formatActivityDateTime(row.declinedAt)}` : null}
                {row.revokedAt ? ` · revoked ${formatActivityDateTime(row.revokedAt)}` : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {success ? <p className="mt-3 text-[13px] text-[var(--success)]">{success}</p> : null}
      {error ? <p className="mt-3 text-[13px] text-destructive">{error}</p> : null}

      {!canManageInvitations ? (
        <p className="mt-3 text-[12px] text-muted-foreground">
          Alta Private invitations can only be sent or revoked by admins.
        </p>
      ) : null}
    </section>
  );
}
