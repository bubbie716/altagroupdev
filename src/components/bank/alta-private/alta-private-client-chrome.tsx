"use client";

import { Link } from "@tanstack/react-router";
import type { AltaPrivateClientContext } from "@/lib/bank/alta-private-client.types";
import { cn } from "@/lib/utils";

export function AltaPrivateMemberLine({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground",
        className,
      )}
    >
      Alta Private Client
    </span>
  );
}

/** Subtle accent beneath the bank page hero for active members. */
export function AltaPrivateHeroAccent({ context }: { context: AltaPrivateClientContext }) {
  if (!context.isMember) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/40 pt-4">
      <AltaPrivateMemberLine />
      {context.memberSinceLabel ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80">
          Member since {context.memberSinceLabel}
        </span>
      ) : null}
    </div>
  );
}

export function AltaPrivateBankerCard({
  context,
  className,
}: {
  context: AltaPrivateClientContext;
  className?: string;
}) {
  if (!context.isMember || !context.banker) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-border/70 bg-surface-1/60 px-4 py-4 sm:px-5 sm:py-5",
        className,
      )}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Your Private Banker
      </p>
      <p className="mt-2 font-medium text-[15px]">{context.banker.name}</p>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{context.banker.title}</p>
      <p className="mt-3 text-[12px] text-muted-foreground">
        Message your banker through Alta when direct messaging is enabled on your account.
      </p>
    </div>
  );
}

export function AltaPrivateMemberSinceCard({
  context,
  className,
}: {
  context: AltaPrivateClientContext;
  className?: string;
}) {
  if (!context.isMember) return null;

  return (
    <div className={cn("rounded-lg border border-border/70 bg-surface-1/60 px-4 py-4", className)}>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Alta Private
      </p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        Member since
      </p>
      <p className="mt-1 font-serif text-xl tracking-tight">
        {context.memberSinceLabel ?? "—"}
      </p>
    </div>
  );
}

export function AltaPrivateRelationshipSnapshot({
  context,
  className,
}: {
  context: AltaPrivateClientContext;
  className?: string;
}) {
  if (!context.isMember) return null;

  return (
    <div
      className={cn(
        "grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2",
        className,
      )}
    >
      <SnapshotCell label="Relationship tier" value={context.relationshipTierLabel ?? "—"} />
      <SnapshotCell label="Alta Private" value="Active" accent />
    </div>
  );
}

function SnapshotCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-surface-1 px-4 py-4 sm:px-5 sm:py-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-2 font-medium text-[15px]", accent && "text-foreground")}>{value}</p>
    </div>
  );
}

export function AltaPrivateBenefitsHint({
  context,
  className,
  linkToPrivate = true,
}: {
  context: AltaPrivateClientContext;
  className?: string;
  linkToPrivate?: boolean;
}) {
  if (!context.isMember || context.benefits.length === 0) return null;

  return (
    <div className={cn("rounded-lg border border-border/60 bg-surface-1/40 px-4 py-4", className)}>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Your Alta Private benefits
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {context.benefits.map((benefit) => (
          <li
            key={benefit}
            className="rounded-full border border-border/60 px-2.5 py-1 text-[12px] text-muted-foreground"
          >
            {benefit}
          </li>
        ))}
      </ul>
      {linkToPrivate ? (
        <Link
          to="/bank/private"
          className="mt-4 inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/80 hover:text-gold hover:underline"
        >
          View Alta Private →
        </Link>
      ) : null}
    </div>
  );
}

export function AltaPrivateDashboardIntro({
  context,
  className,
}: {
  context: AltaPrivateClientContext;
  className?: string;
}) {
  if (!context.isMember) return null;

  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-[15px] text-muted-foreground">{context.welcomeBackGreeting}</p>
      <AltaPrivateMemberLine />
    </div>
  );
}
