import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Card } from "@/components/page-shell";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/use-current-user";
import { createCompanyRecord } from "@/lib/company/company.functions";
import {
  COMPANY_TYPE_OPTIONS,
  INTENDED_USE_OPTIONS,
  type CompanyTypeValue,
  type CreateCompanyInput,
  type IntendedUseValue,
} from "@/lib/company/types";

const fieldLabel =
  "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40";

export function CompanyCreateForm() {
  const router = useRouter();
  const user = useCurrentUser();

  const [name, setName] = useState("");
  const [type, setType] = useState<CompanyTypeValue>("private_company");
  const [sector, setSector] = useState("");
  const [desiredTicker, setDesiredTicker] = useState("");
  const [description, setDescription] = useState("");
  const [headquarters, setHeadquarters] = useState("");
  const [intendedUses, setIntendedUses] = useState<IntendedUseValue[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleIntendedUse(use: IntendedUseValue) {
    setIntendedUses((prev) =>
      prev.includes(use) ? prev.filter((u) => u !== use) : [...prev, use],
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !sector.trim() || !description.trim()) {
      setError("Company name, sector, and description are required.");
      return;
    }
    if (intendedUses.length === 0) {
      setError("Select at least one intended use.");
      return;
    }

    setSubmitting(true);
    try {
      const input: CreateCompanyInput = {
        name: name.trim(),
        type,
        sector: sector.trim(),
        desiredTicker: desiredTicker.trim() || undefined,
        description: description.trim(),
        headquarters: headquarters.trim() || undefined,
        primaryContactDiscordUsername: user?.discordUsername ?? "",
        intendedUses,
      };

      const result = await createCompanyRecord({ data: input });
      await router.navigate({
        to: "/companies/$companyId",
        params: { companyId: result.companyId },
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message.replace(/^BAD_REQUEST:/, "")
          : "Unable to register company.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-6">
      <Card className="space-y-6 !p-6">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Register a company or institution on Alta. You will be assigned as the primary owner and
          authorized representative. Companies do not log in directly — individuals act on their
          behalf through membership roles.
        </p>

        <label className="block">
          <span className={fieldLabel}>Company name</span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Harbor Logistics Group"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={fieldLabel}>Company type</span>
          <Select value={type} onValueChange={(v) => setType(v as CompanyTypeValue)}>
            <SelectTrigger className={`${inputClass} h-auto min-h-10`}>
              <SelectValue placeholder="Select company type" />
            </SelectTrigger>
            <SelectContent>
              {COMPANY_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="block">
          <span className={fieldLabel}>Sector</span>
          <input
            type="text"
            required
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            placeholder="Industrials"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={fieldLabel}>Desired ticker (optional)</span>
          <input
            type="text"
            value={desiredTicker}
            onChange={(e) => setDesiredTicker(e.target.value.toUpperCase())}
            placeholder="HLOG"
            className={`${inputClass} font-mono uppercase`}
          />
        </label>

        <label className="block">
          <span className={fieldLabel}>Description</span>
          <Textarea
            autoResize
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the business, operations, and market position…"
            className={`${inputClass} min-h-[120px]`}
          />
        </label>

        <label className="block">
          <span className={fieldLabel}>Headquarters (optional)</span>
          <input
            type="text"
            value={headquarters}
            onChange={(e) => setHeadquarters(e.target.value)}
            placeholder="Newport, Republic of Alta"
            className={inputClass}
          />
        </label>

        <fieldset>
          <legend className={fieldLabel}>Intended use</legend>
          <div className="mt-3 space-y-2">
            {INTENDED_USE_OPTIONS.map((o) => (
              <label key={o.value} className="flex items-center gap-3 text-[13px]">
                <input
                  type="checkbox"
                  checked={intendedUses.includes(o.value)}
                  onChange={() => toggleIntendedUse(o.value)}
                  className="size-4 rounded border-border"
                />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5 !p-4">
          <p className="text-[13px] text-destructive">{error}</p>
        </Card>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-foreground px-5 py-3 text-[13px] font-medium tracking-wide text-background disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Registering…" : "Register company"}
      </button>
    </form>
  );
}
