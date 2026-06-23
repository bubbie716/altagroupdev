import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/page-shell";
import { AuthGate, LoginPortalFooter, LoginPortalShell } from "@/components/auth/auth-gate";
import { useCurrentUser } from "@/hooks/use-current-user";

type LoginSearch = {
  redirect?: string;
  error?: string;
};

const ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: "Discord authorization was cancelled.",
  invalid_state: "Login session expired. Please try again.",
  token_exchange_failed: "Could not complete Discord sign-in.",
  profile_fetch_failed: "Could not load your Discord profile.",
  oauth_not_configured: "Discord OAuth is not configured on this environment.",
  database_not_configured: "Database is not configured (DATABASE_URL).",
  session_not_configured: "Session signing is not configured (SESSION_SECRET).",
  session_failed: "Could not create a login session.",
};

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  head: () => ({ meta: [{ title: "Sign In — Alta Group" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect, error } = Route.useSearch();
  const user = useCurrentUser();

  if (user) {
    return (
      <LoginPortalShell footer={<LoginPortalFooter />}>
        <div className="w-full max-w-md text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-gold">Alta Group</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Already signed in</h1>
          <Card className="mt-8 border-border/80 bg-card/95 !p-6 text-left shadow-sm backdrop-blur-sm">
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{user.discordUsername}</span>.
            </p>
            <Link
              to={redirect ?? "/profile"}
              className="mt-4 inline-block text-sm text-gold underline-offset-2 hover:underline"
            >
              Continue to platform →
            </Link>
          </Card>
        </div>
      </LoginPortalShell>
    );
  }

  const redirectTo = redirect ?? "/profile";
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <LoginPortalShell footer={<LoginPortalFooter />}>
      <AuthGate
        redirectTo={redirectTo}
        errorMessage={errorMessage}
      />
    </LoginPortalShell>
  );
}
