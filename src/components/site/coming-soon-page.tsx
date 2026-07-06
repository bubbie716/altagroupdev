import { Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { useSiteContext } from "@/hooks/use-site-context";

export function ComingSoonPage({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  const site = useSiteContext();

  return (
    <div className="flex min-h-full w-full flex-1 flex-col bg-background">
      <SiteNav />
      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-6 py-24">
        <div className="type-eyebrow">{eyebrow}</div>
        <h1 className="mt-5 text-[clamp(2.5rem,5vw,4rem)] font-semibold leading-[0.98] tracking-[-0.02em]">
          {title}
        </h1>
        <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-muted-foreground">{description}</p>
        <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.2em] text-gold">Coming Soon</p>
        {children ? <div className="mt-8">{children}</div> : null}
        <Link
          to={site.homeRoute}
          className="mt-10 inline-flex w-fit text-sm text-muted-foreground transition-colors hover:text-gold"
        >
          Return to {site.displayName}
        </Link>
      </main>
    </div>
  );
}
