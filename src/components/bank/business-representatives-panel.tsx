import { Card } from "@/components/page-shell";
import type { BusinessRepresentativeRow } from "@/lib/bank/business-banking-types";

const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: "Full access to treasury operations, settings, and representatives.",
  executive: "Full treasury access including payments and payroll.",
  finance_manager: "Payments and payroll access for day-to-day treasury operations.",
  compliance_contact: "View-only access to treasury activity and representative roster.",
  viewer: "No treasury access.",
};

export function BusinessRepresentativesPanel({
  representatives,
}: {
  representatives: BusinessRepresentativeRow[];
}) {
  const treasuryRoles = representatives.filter((r) => r.role !== "viewer");

  return (
    <div className="space-y-8">
      <Card className="!p-6">
        <div className="type-meta">
          Authorized representatives
        </div>
        <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          Treasury permissions are derived from company membership roles. Owners and executives
          receive full access; finance managers handle payments and payroll; compliance contacts
          have read-only visibility.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="alta-table w-full min-w-[520px] text-sm">
            <thead>
              <tr>
                <th>Representative</th>
                <th>Role</th>
                <th>Treasury access</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {treasuryRoles.map((r) => (
                <tr key={r.membershipId}>
                  <td>{r.discordUsername}</td>
                  <td>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
                      {r.role.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="text-muted-foreground">
                    {r.role === "compliance_contact" ? "View only" : "Full treasury"}
                  </td>
                  <td className="text-muted-foreground">
                    {new Date(r.joinedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {(["owner", "executive", "finance_manager", "compliance_contact"] as const).map((role) => (
          <Card key={role} className="!p-5">
            <div className="type-meta-accent">
              {role.replace(/_/g, " ")}
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
              {ROLE_DESCRIPTIONS[role]}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
