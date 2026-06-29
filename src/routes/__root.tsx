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
import { fetchRootSession } from "@/lib/auth/root-session.functions";
import { isMaintenanceBypassUser } from "@/lib/platform/maintenance-guard";
import type { AltaUser } from "@/lib/auth/types";
import "@/lib/auth/router-context";
import { getUiLabUserIfEnabled, isUiLabMode } from "@/lib/auth/ui-lab";
import { LegalMicroFooter } from "@/components/footers";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
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
      <LegalMicroFooter context="login" />
    </div>
  );
}

function ErrorComponent({ error }: { error: Error; reset: () => void }) {
  console.error(error);
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
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
              onClick={() => window.location.reload()}
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
      <LegalMicroFooter context="login" />
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient; user: AltaUser | null }>()({
  beforeLoad: async ({ location }) => {
    // UI LAB ONLY — DO NOT ENABLE IN PRODUCTION
    const labUser = getUiLabUserIfEnabled();
    if (labUser) return { user: labUser };

    let user: AltaUser | null = null;
    let maintenanceEnabled = false;
    try {
      const session = await fetchRootSession();
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

    return { user };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Alta Group — Financial Infrastructure" },
      { name: "description", content: "Alta Group: Live Like the 1%. Alta Bank, Alta Exchange, and Newport Clearing Corporation." },
      { name: "author", content: "Alta Group" },
      { property: "og:title", content: "Alta Group" },
      { property: "og:description", content: "Banking. Markets. Capital. Built for Newport." },
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
  }),
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
        {isUiLabMode() && <UiLabBanner />}
        <SiteReturnPathTracker />
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
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
