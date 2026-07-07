import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  redirect,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ThemeProvider, THEME_INIT_SCRIPT } from "../components/theme";
import { SiteReturnPathTracker } from "@/components/navigation/site-return-path-tracker";
import { RouteTransitionProvider } from "@/components/navigation/route-transition";
import { loadRootSession } from "@/lib/auth/root-session-loader";
import { isMaintenanceBypassUser } from "@/lib/platform/maintenance-guard";
import type { AltaUser } from "@/lib/auth/types";
import "@/lib/auth/router-context";
import { getUiLabUserIfEnabled, isUiLabMode } from "@/lib/auth/ui-lab";
import { resolveSiteContextFromRequest, readRequestHost } from "@/lib/site/site-context";
import { resolveEntitySubdomainRedirect, resolveLegacyEntityHostRedirect } from "@/lib/site/entity-path-guard";
import { getDefaultSiteConfig } from "@/config/sites";
import { FooterProvider } from "@/lib/platform/footer-context";
import { SiteFooterGate } from "@/components/site-footer-gate";
import { NumberInputScrollGuard } from "@/components/number-input-scroll-guard";

function NotFoundComponent() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-7xl font-bold text-foreground">404</h1>
          <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div className="mt-6">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Go home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: { error: Error; reset: () => void }) {
  console.error(error);
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            This page didn't load
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Something went wrong on our end. You can try refreshing or head back home.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                window.location.href = window.location.href;
              }}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Try again
            </button>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Go home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient; user: AltaUser | null; site: import("@/config/sites").SiteConfig }>()({
  beforeLoad: async ({ location }) => {
    const legacyHostRedirect = resolveLegacyEntityHostRedirect(location.pathname, {
      host: readRequestHost(),
      searchStr:
        typeof location.searchStr === "string"
          ? location.searchStr
          : undefined,
    });
    if (legacyHostRedirect) {
      throw redirect({ href: legacyHostRedirect, replace: true });
    }

    const entityRedirect = resolveEntitySubdomainRedirect(location.pathname, {
      host: readRequestHost(),
      searchStr:
        typeof location.searchStr === "string"
          ? location.searchStr
          : undefined,
    });
    if (entityRedirect) {
      throw redirect({ href: entityRedirect, replace: true });
    }

    const site = resolveSiteContextFromRequest(
      location.search as Record<string, unknown>,
      location.pathname,
    );

    // UI LAB ONLY — DO NOT ENABLE IN PRODUCTION
    const labUser = getUiLabUserIfEnabled();
    if (labUser) return { user: labUser, site };

    let user: AltaUser | null = null;
    let maintenanceEnabled = false;
    try {
      const session = await loadRootSession();
      user = session.user;
      maintenanceEnabled = session.maintenanceEnabled;
    } catch (error) {
      console.error("[auth] Failed to load root session", error);
    }

    const pathname = location.pathname;
    const { shouldEnforceMaintenance } = await import("@/lib/platform/maintenance-guard");

    if (maintenanceEnabled && isMaintenanceBypassUser(user) && pathname === "/maintenance") {
      throw redirect({ to: "/" });
    }

    if (maintenanceEnabled && shouldEnforceMaintenance(pathname, user)) {
      throw redirect({ to: "/maintenance" });
    }

    if (pathname === "/maintenance" && !maintenanceEnabled && !isMaintenanceBypassUser(user)) {
      throw redirect({ to: "/" });
    }

    return { user, site };
  },
  head: ({ context }) => {
    const site = context?.site ?? getDefaultSiteConfig();
    return {
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: site.seo.title },
      { name: "description", content: site.seo.description },
      { name: "author", content: site.displayName },
      { property: "og:title", content: site.seo.ogTitle ?? site.seo.title },
      { property: "og:description", content: site.seo.ogDescription ?? site.seo.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouteTransitionProvider>
          <FooterProvider>
            <NumberInputScrollGuard />
            {isUiLabMode() && <UiLabBanner />}
            <SiteReturnPathTracker />
            <div className="flex min-h-screen flex-col">
              <div className="flex min-h-0 flex-1 flex-col">
                {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
                <Outlet />
              </div>
              <SiteFooterGate />
            </div>
          </FooterProvider>
        </RouteTransitionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/** UI LAB ONLY — DO NOT ENABLE IN PRODUCTION */
function UiLabBanner() {
  return (
    <div
      role="status"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 9999,
        width: "100%",
        background: "rgb(180, 83, 9)",
        color: "white",
        padding: "6px 14px",
        textAlign: "center",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
      }}
    >
      UI Lab Mode Active — Using Mock Admin User
    </div>
  );
}
