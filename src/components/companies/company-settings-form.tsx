import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/page-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MockActionButton } from "@/components/internal/mock-action-button";
import { updateCompanySettingsRecord } from "@/lib/company/company.functions";
import type { CompanyDetail } from "@/lib/company/types";
import { SUBMITTING_COPY } from "@/lib/ui/route-loading";

export function CompanySettingsForm({ company }: { company: CompanyDetail }) {
  const router = useRouter();
  const updateSettings = useServerFn(updateCompanySettingsRecord);
  const [name, setName] = useState(company.name);
  const [sector, setSector] = useState(company.sector ?? "");
  const [description, setDescription] = useState(company.description ?? "");
  const [headquarters, setHeadquarters] = useState(company.headquarters ?? "");
  const [desiredTicker, setDesiredTicker] = useState(company.desiredTicker ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tickerLocked = company.ticker !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateSettings({
        data: {
          companyId: company.id,
          name,
          sector,
          description,
          headquarters: headquarters || undefined,
          desiredTicker: tickerLocked ? undefined : desiredTicker || undefined,
        },
      });
      setMessage("Company profile updated.");
      await router.invalidate();
    } catch {
      setError("Unable to save settings. Only owners may edit company profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <form onSubmit={handleSubmit}>
        <Card className="space-y-5 !p-6">
          <h3 className="font-medium tracking-tight">Company profile</h3>

          <label className="block">
            <span className="type-meta">
              Company name
            </span>
            <Input className="mt-2" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>

          <label className="block">
            <span className="type-meta">
              Sector
            </span>
            <Input className="mt-2" value={sector} onChange={(e) => setSector(e.target.value)} required />
          </label>

          <label className="block">
            <span className="type-meta">
              Description
            </span>
            <Textarea
              className="mt-2 min-h-[120px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="type-meta">
              Headquarters
            </span>
            <Input className="mt-2" value={headquarters} onChange={(e) => setHeadquarters(e.target.value)} />
          </label>

          <label className="block">
            <span className="type-meta">
              Desired ticker
            </span>
            <Input
              className="mt-2 font-mono uppercase"
              value={desiredTicker}
              onChange={(e) => setDesiredTicker(e.target.value.toUpperCase())}
              disabled={tickerLocked}
              maxLength={8}
            />
            {tickerLocked && (
              <p className="mt-2 text-[12px] text-muted-foreground">
                Official ticker {company.ticker} is assigned — desired ticker cannot be changed.
              </p>
            )}
          </label>

          {message && <p className="text-[13px] text-foreground">{message}</p>}
          {error && <p className="text-[13px] text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-foreground px-5 py-2.5 text-[13px] font-medium text-background disabled:opacity-60"
          >
            {saving ? SUBMITTING_COPY.saving : "Save changes"}
          </button>
        </Card>
      </form>

      <Card className="space-y-4 border-destructive/30 !p-6">
        <h3 className="font-medium tracking-tight text-destructive">Danger zone</h3>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Ownership transfer, archival, and verification requests require Alta operations review.
          These actions are simulated in this release.
        </p>
        <div className="flex flex-wrap gap-2">
          <MockActionButton label="Transfer ownership" variant="danger" />
          <MockActionButton label="Archive company" variant="danger" />
          <MockActionButton label="Request verification" variant="primary" />
        </div>
      </Card>
    </div>
  );
}
