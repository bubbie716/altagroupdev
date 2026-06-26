import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/page-shell";
import { LoginPortalShell } from "@/components/auth/auth-gate";
import { LegalMicroFooter } from "@/components/footers";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/access-restricted")({
  head: () => ({ meta: [{ title: "Access Restricted — Alta Group" }] }),
  component: AccessRestrictedPage,
});

function AccessRestrictedPage() {
  const user = useCurrentUser();

  return (
    <LoginPortalShell footer={<LegalMicroFooter context="access-restricted" />}>
      <div className="w-full max-w-md text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-gold">Alta Group</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">Access Restricted</h1>
        <p className="mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
          Your account does not have permission to view this area.
        </p>

        <Card className="mt-8 border-border/80 bg-card/95 !p-6 text-left shadow-sm backdrop-blur-sm">
          {user ? (
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{user.discordUsername}</span>. Contact Alta
            operations if you believe this is an error.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">You must sign in with an authorized Alta account.</p>
          )}
          <div className="mt-6 flex justify-center gap-4">
            <Link to="/" className="text-sm text-gold hover:underline">
              Return home
            </Link>
            <Link to="/profile" className="text-sm text-muted-foreground hover:text-foreground">
              View profile
            </Link>
          </div>
        </Card>
      </div>
    </LoginPortalShell>
  );
}
