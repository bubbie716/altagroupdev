import { Link } from "@tanstack/react-router";
import { AuthGate, LoginPortalShell } from "@/components/auth/auth-gate";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSiteContext } from "@/hooks/use-site-context";

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

export function EntityLoginPage({
  redirect,
  error,
}: {
  redirect?: string;
  error?: string;
}) {
  const user = useCurrentUser();
  const site = useSiteContext();
  const redirectTo = redirect ?? site.defaultAuthenticatedRoute;

  if (user) {
    const displayName = user.minecraftUsername?.trim() || user.discordUsername;

    return (
      <LoginPortalShell brandEyebrow={`${site.displayName} · Welcome Back`}>
        <div className="w-full max-w-md">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-gold">
            Already signed in
          </p>
          <h2 className="mt-3 font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
            Welcome back, {displayName}.
          </h2>
          <div className="mt-8 rounded-lg border border-border bg-surface-1 p-7">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Continue your session
            </div>
            <Link
              to={redirectTo}
              className="mt-3 inline-flex items-center gap-2 font-serif text-lg text-foreground hover:text-gold"
            >
              {site.key === "corporate" ? "Enter Alta Group" : `Continue to ${site.shortName}`}{" "}
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </LoginPortalShell>
    );
  }

  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <LoginPortalShell brandEyebrow={site.loginEyebrow}>
      <AuthGate redirectTo={redirectTo} errorMessage={errorMessage} />
    </LoginPortalShell>
  );
}
