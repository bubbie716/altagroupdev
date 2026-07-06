import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { useSiteContext } from "@/hooks/use-site-context";
import { useCurrentUser } from "@/hooks/use-current-user";
import { SiteInternalLink } from "@/components/site/site-internal-link";
import { cn } from "@/lib/utils";

export function EntityMarketingShell({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
}) {
  const site = useSiteContext();
  const user = useCurrentUser();
  const displayName = user?.minecraftUsername?.trim() || user?.discordUsername;

  return (
    <div className={cn("flex min-h-full w-full flex-1 flex-col bg-background", className)}>
      <SiteNav />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-16 sm:px-6 sm:py-24">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-gold">{eyebrow}</p>
        <h1 className="mt-5 max-w-4xl font-serif text-[clamp(2.5rem,5vw,4.25rem)] font-semibold leading-[0.98] tracking-[-0.02em]">
          {title}
        </h1>
        <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{description}</p>
        <div className="mt-10 flex flex-wrap gap-3">
          {site.ctaLabel && site.ctaRoute ? (
            <SiteInternalLink
              siteKey={site.key}
              to={site.ctaRoute}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {site.ctaLabel}
              <ArrowUpRight className="size-4" aria-hidden />
            </SiteInternalLink>
          ) : null}
          {user && displayName ? (
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Welcome back,{" "}
              <span className="font-medium text-foreground">{displayName}</span>.
            </p>
          ) : (
            <SiteInternalLink
              siteKey={site.key}
              to="/login"
              search={{ redirect: site.defaultAuthenticatedRoute }}
              className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-surface-2/60"
            >
              Sign In
            </SiteInternalLink>
          )}
        </div>
        {children}
      </main>
    </div>
  );
}

export function EntityFeatureGrid({
  items,
}: {
  items: Array<
    | { title: string; description: string; to: string }
    | { title: string; description: string; href: string; external: true }
  >;
}) {
  const site = useSiteContext();

  return (
    <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) =>
        "external" in item && item.external ? (
          <a
            key={item.title}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-lg border border-border/70 bg-surface-1/40 p-6 transition-colors hover:border-border-strong hover:bg-surface-1/70"
          >
            <h2 className="font-serif text-xl tracking-tight text-foreground group-hover:text-gold">
              {item.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
          </a>
        ) : (
          <SiteInternalLink
            key={item.title}
            siteKey={site.key}
            to={item.to}
            className="group rounded-lg border border-border/70 bg-surface-1/40 p-6 transition-colors hover:border-border-strong hover:bg-surface-1/70"
          >
            <h2 className="font-serif text-xl tracking-tight text-foreground group-hover:text-gold">
              {item.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
          </SiteInternalLink>
        ),
      )}
    </section>
  );
}
