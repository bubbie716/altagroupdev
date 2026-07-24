import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { useSiteContext } from "@/hooks/use-site-context";
import { ALTA_DISCORD_URLS } from "@/lib/site/discord-urls";
import { getDiscordCommunitiesForSite } from "@/lib/site/site-scoped-content";

export const Route = createFileRoute("/support/")({
  head: () => ({
    meta: [{ title: "Support Center — Alta Group" }],
  }),
  component: SupportCenterPage,
});

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function SupportCenterPage() {
  const site = useSiteContext();
  const communities = getDiscordCommunitiesForSite(site.key);

  return (
    <div className="flex min-h-full w-full flex-1 flex-col bg-background">
      <SiteNav />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-24">
        <div className="type-eyebrow">Alta Support</div>
        <h1 className="mt-5 text-[clamp(2.5rem,5vw,4rem)] font-semibold leading-[0.98] tracking-[-0.02em]">
          Support Center
        </h1>
        <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          {site.key === "corporate"
            ? "Join the official Alta Discord communities for support, updates, and discussion across the portfolio."
            : `Join the official Alta Discord communities for ${site.displayName} and Alta Group support, updates, and discussion.`}
        </p>

        <ul className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          {communities.map((community) => {
            const inviteUrl = ALTA_DISCORD_URLS[community.entity];
            const isFeatured = community.entity === "group" && communities.length === 3;

            return (
              <li
                key={community.entity}
                className={
                  isFeatured
                    ? "flex flex-col bg-surface-1 p-6 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between sm:gap-10 sm:p-8"
                    : "flex flex-col bg-surface-1 p-6 sm:p-7"
                }
              >
                <div className={isFeatured ? "min-w-0 flex-1" : undefined}>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Discord
                  </div>
                  <h2 className="mt-3 text-xl font-semibold tracking-tight">{community.label}</h2>
                  <p
                    className={
                      isFeatured
                        ? "mt-3 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground"
                        : "mt-3 flex-1 text-[13.5px] leading-relaxed text-muted-foreground"
                    }
                  >
                    {community.description}
                  </p>
                </div>
                <div className={isFeatured ? "mt-6 shrink-0 sm:mt-0" : "mt-6"}>
                  {inviteUrl ? (
                    isFeatured ? (
                      <a
                        href={inviteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2.5 rounded-md border border-[#4752C4]/30 bg-[#5865F2] px-5 py-2.5 text-[13px] font-medium text-white shadow-sm transition-[opacity,box-shadow] hover:opacity-95 hover:shadow-md"
                      >
                        <DiscordIcon className="size-4 shrink-0" />
                        Join Discord
                      </a>
                    ) : (
                      <a
                        href={inviteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-gold"
                      >
                        Join Discord
                        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </a>
                    )
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
