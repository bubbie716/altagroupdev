"use client";

import { useState, type ReactNode } from "react";
import { SUBMITTING_COPY } from "@/lib/ui/route-loading";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { AltaPrivateInvitationSummary } from "@/lib/bank/alta-private-types";
import {
  acceptAltaPrivateInvitationRecord,
  declineAltaPrivateInvitationRecord,
} from "@/lib/bank/alta-private.functions";
import { cn } from "@/lib/utils";

const BENEFITS = [
  "Relationship pricing",
  "Gold Card eligibility",
  "Priority application review",
  "Higher transfer limits",
  "Dedicated banker",
  "Negotiated lending",
  "Bespoke financial services",
];

export function AltaPrivateInvitationExperience({
  invitation,
  compact = false,
}: {
  invitation: AltaPrivateInvitationSummary;
  compact?: boolean;
}) {
  const router = useRouter();
  const acceptInvitation = useServerFn(acceptAltaPrivateInvitationRecord);
  const declineInvitation = useServerFn(declineAltaPrivateInvitationRecord);
  const [submitting, setSubmitting] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [declined, setDeclined] = useState(false);

  async function handleAccept() {
    setSubmitting("accept");
    setError(null);
    try {
      await acceptInvitation({ data: invitation.id });
      setAccepted(true);
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Unable to accept invitation.");
    } finally {
      setSubmitting(null);
    }
  }

  async function handleDecline() {
    setSubmitting("decline");
    setError(null);
    try {
      await declineInvitation({ data: invitation.id });
      setDeclined(true);
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Unable to decline invitation.");
    } finally {
      setSubmitting(null);
    }
  }

  if (accepted) {
    return (
      <InvitationStateCard
        title="Welcome to Alta Private."
        body="Your Alta Private membership is now active. Your private banking experience is ready."
        action={
          <Link
            to="/bank/private"
            className="inline-flex rounded-md border border-gold/50 bg-gold/[0.08] px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] hover:bg-gold/[0.14]"
          >
            View Alta Private →
          </Link>
        }
      />
    );
  }

  if (declined) {
    return (
      <InvitationStateCard
        title="Invitation Declined"
        body="You can contact Alta if you would like to revisit this later."
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-gold/30 bg-gold/5",
        compact ? "p-5" : "p-6 sm:p-8",
      )}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">Alta Private Invitation</p>
      <h2 className="mt-3 font-serif text-2xl tracking-tight sm:text-3xl">You&apos;re Invited to Alta Private</h2>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
        Your relationship with Alta qualifies you for our invitation-only private banking program.
      </p>
      {invitation.invitationMessage ? (
        <blockquote className="mt-5 rounded-lg border border-border/60 bg-surface-1/80 px-4 py-3 text-[14px] leading-relaxed italic">
          {invitation.invitationMessage}
        </blockquote>
      ) : null}
      <ul className="mt-6 grid gap-2 sm:grid-cols-2">
        {BENEFITS.map((benefit) => (
          <li
            key={benefit}
            className="rounded-lg border border-border/60 bg-surface-1/60 px-4 py-3 text-[13px]"
          >
            {benefit}
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={submitting !== null}
          onClick={() => void handleAccept()}
          className="rounded-md border border-gold/50 bg-gold/[0.08] px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] hover:bg-gold/[0.14] disabled:opacity-50"
        >
          {submitting === "accept" ? SUBMITTING_COPY.accepting : "Accept Invitation"}
        </button>
        <button
          type="button"
          disabled={submitting !== null}
          onClick={() => void handleDecline()}
          className="rounded-md border border-border px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] hover:border-gold/40 disabled:opacity-50"
        >
          {submitting === "decline" ? SUBMITTING_COPY.declining : "Decline"}
        </button>
      </div>
      {error ? <p className="mt-4 text-[13px] text-destructive">{error}</p> : null}
    </div>
  );
}

function InvitationStateCard({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gold/30 bg-gold/5 p-6 sm:p-8">
      <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function AltaPrivateAspirationalPage() {
  return (
    <div className="rounded-xl border border-border bg-surface-1/80 p-6 sm:p-10">
      <h2 className="font-serif text-3xl tracking-tight">Alta Private</h2>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
        Alta Private is available by invitation to clients with significant relationships across Alta.
      </p>
    </div>
  );
}

export function AltaPrivateDeclinedPage() {
  return (
    <InvitationStateCard
      title="Invitation Declined"
      body="You can contact Alta if you would like to revisit this later."
    />
  );
}
