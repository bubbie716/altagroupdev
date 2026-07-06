import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronLeft } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import {
  ALTA_DISCORD_COMMUNITIES,
  ALTA_DISCORD_URLS,
} from "@/lib/site/discord-urls";

export const Route = createFileRoute("/support/")({
  head: () => ({
    meta: [
      { title: "Support Center — Alta Group" },
      {
        name: "description",
        content: "Official Alta Discord communities for Alta Group, Alta Bank, Alta Markets, and NCC.",
      },
    ],
  }),
  component: SupportCenterPage,
});

function SupportCenterPage() {
  return (
    <div className="flex min-h-full w-full flex-1 flex-col bg-background">
      <SiteNav />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-24">
        <div className="type-eyebrow">Alta Support</div>
        <h1 className="mt-5 text-[clamp(2.5rem,5vw,4rem)] font-semibold leading-[0.98] tracking-[-0.02em]">
          Support Center
        </h1>
        <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Join the official Alta Discord communities for platform support, division updates, and
          community discussion.
        </p>

        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          Return home
        </Link>

        <ul className="mt-8 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          {ALTA_DISCORD_COMMUNITIES.map((community) => {
            const inviteUrl = ALTA_DISCORD_URLS[community.entity];

            return (
              <li key={community.entity} className="flex flex-col bg-surface-1 p-6 sm:p-7">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Discord
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-tight">{community.label}</h2>
                <p className="mt-3 flex-1 text-[13.5px] leading-relaxed text-muted-foreground">
                  {community.description}
                </p>
                <div className="mt-6">
                  {inviteUrl ? (
                    <a
                      href={inviteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-gold"
                    >
                      Join Discord
                      <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </a>
                  ) : (
                    <Link
                      to={community.route}
                      className="group inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-gold"
                    >
                      Invite link coming soon
                      <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
