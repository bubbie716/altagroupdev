import { Card } from "@/components/page-shell";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COMPANY_TYPE_OPTIONS,
  INTENDED_USE_OPTIONS,
} from "@/lib/company/types";

const fieldLabel =
  "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground";

const previewFieldClass =
  "mt-2 w-full cursor-not-allowed rounded-md border border-border bg-surface-2/50 px-3 py-2 text-sm text-muted-foreground shadow-none placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-0";

function PreviewSelect({
  label,
  placeholder,
  options,
}: {
  label: string;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className={fieldLabel}>{label}</span>
      <Select disabled>
        <SelectTrigger
          className={`${previewFieldClass} h-auto min-h-10 disabled:cursor-not-allowed disabled:opacity-100 [&>svg]:text-muted-foreground [&>svg]:opacity-50`}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

export function CompanyCreateForm() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
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
            readOnly
            placeholder="Harbor Logistics Group"
            className={previewFieldClass}
          />
        </label>

        <PreviewSelect
          label="Company type"
          placeholder="Select company type"
          options={COMPANY_TYPE_OPTIONS}
        />

        <label className="block">
          <span className={fieldLabel}>Sector</span>
          <input type="text" readOnly placeholder="Industrials" className={previewFieldClass} />
        </label>

        <label className="block">
          <span className={fieldLabel}>Desired ticker (optional)</span>
          <input
            type="text"
            readOnly
            placeholder="HLOG"
            className={`${previewFieldClass} font-mono uppercase`}
          />
        </label>

        <label className="block">
          <span className={fieldLabel}>Description</span>
          <Textarea
            autoResize
            readOnly
            placeholder="Brief description of the business, operations, and market position…"
            className={`${previewFieldClass} min-h-[120px]`}
          />
        </label>

        <label className="block">
          <span className={fieldLabel}>Headquarters (optional)</span>
          <input
            type="text"
            readOnly
            placeholder="Newport, Republic of Alta"
            className={previewFieldClass}
          />
        </label>

        <label className="block">
          <span className={fieldLabel}>Primary contact Discord username</span>
          <input
            type="text"
            readOnly
            placeholder="username"
            className={`${previewFieldClass} font-mono`}
          />
        </label>

        <fieldset disabled className="opacity-100">
          <legend className={fieldLabel}>Intended use</legend>
          <div className="mt-3 space-y-2">
            {INTENDED_USE_OPTIONS.map((o) => (
              <label
                key={o.value}
                className="flex cursor-not-allowed items-center gap-3 text-[13px] text-muted-foreground"
              >
                <input
                  type="checkbox"
                  disabled
                  className="size-4 cursor-not-allowed rounded border-border bg-surface-2/50"
                />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      <Card className="border-gold/30 bg-gold/5 !p-4">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Self-service company registration is in preview. Fields are read-only until Alta enables
          live submissions. Contact Alta operations to register entities in the interim.
        </p>
      </Card>

      <button
        type="button"
        disabled
        className="w-full cursor-not-allowed rounded-md bg-foreground/40 px-5 py-3 text-[13px] font-medium tracking-wide text-background/70"
      >
        Register company (preview only)
      </button>
    </div>
  );
}
