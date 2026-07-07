import { NccLayout } from "@/components/ncc/ncc-layout";
import { NccLogo } from "@/components/ncc/ncc-logo";
import { DiscordSignInButton } from "@/components/auth/auth-gate";
import { useSiteContext } from "@/hooks/use-site-context";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: "Discord authorization was cancelled.",
  invalid_state: "Login session expired. Please try again.",
  token_exchange_failed: "Could not complete Discord sign-in. If this persists, wait a minute and try again.",
  oauth_callback_mismatch:
    "Sign-in landed on the wrong domain. Contact operations if this continues after retrying.",
  profile_fetch_failed: "Could not load your Discord profile.",
  oauth_not_configured: "Discord OAuth is not configured on this environment.",
  database_not_configured: "Database is not configured.",
  session_failed: "Could not create a login session.",
  session_not_configured: "Session signing is not configured (SESSION_SECRET).",
};

export function NccLoginPage({
  redirectTo,
  error,
}: {
  redirectTo?: string;
  error?: string;
}) {
  const site = useSiteContext();
  const destination = redirectTo ?? site.defaultAuthenticatedRoute;

  return (
    <NccLayout>
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <NccLogo size="lg" />
          </div>
          <h1 className="text-center text-xl font-semibold tracking-tight text-[#111827]">
            Institution sign-in
          </h1>
          <p className="mt-3 text-center text-[14px] leading-relaxed text-[#6b7280]">
            Authorized institution representatives may access clearing, settlement, and network
            operations tools.
          </p>

          {error ? (
            <p className="mt-4 rounded-sm border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-center text-[13px] text-[#b91c1c]">
              {ERROR_MESSAGES[error] ?? "Sign-in failed. Please try again."}
            </p>
          ) : null}

          <div className="mt-8">
            <DiscordSignInButton redirectTo={destination} label="Sign in with Discord" />
          </div>

          <p className="mt-6 text-center text-[12px] text-[#9ca3af]">
            Approved institutions · Authorized representatives only
          </p>
        </div>
      </div>
    </NccLayout>
  );
}
