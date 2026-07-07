import { NccLayout } from "@/components/ncc/ncc-layout";
import { NccLogo } from "@/components/ncc/ncc-logo";
import { DiscordSignInButton } from "@/components/auth/auth-gate";
import { useSiteContext } from "@/hooks/use-site-context";

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
              Sign-in failed. Please try again.
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
