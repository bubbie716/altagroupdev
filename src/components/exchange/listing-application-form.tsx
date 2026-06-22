import { Card } from "@/components/page-shell";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Field =
  | { label: string; placeholder: string; type?: "text" | "textarea" | "select"; options?: string[]; span?: 2 };

const previewFieldClass =
  "mt-2 w-full cursor-not-allowed rounded-md border border-border bg-surface-2/50 px-3 py-2 text-sm text-muted-foreground shadow-none";

function toSelectValue(option: string) {
  return option.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function PreviewSelect({
  label,
  placeholder,
  options,
}: {
  label: string;
  placeholder: string;
  options: string[];
}) {
  return (
    <div className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <Select disabled>
        <SelectTrigger
          className={`${previewFieldClass} h-auto min-h-10 disabled:cursor-not-allowed disabled:opacity-100 [&>svg]:text-muted-foreground [&>svg]:opacity-50`}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={toSelectValue(option)}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FormField({ field }: { field: Field }) {
  return (
    <label className={field.span === 2 ? "block md:col-span-2" : "block"}>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {field.label}
      </span>
      {field.type === "textarea" ? (
        <Textarea
          autoResize
          placeholder={field.placeholder}
          className={`${previewFieldClass} min-h-[4.5rem] focus-visible:ring-0`}
        />
      ) : (
        <input
          type="text"
          readOnly
          placeholder={field.placeholder}
          className={previewFieldClass}
        />
      )}
    </label>
  );
}

function FormSection({ title, fields }: { title: string; fields: Field[] }) {
  return (
    <Card>
      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{title}</div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {fields.map((f) =>
          f.type === "select" && f.options ? (
            <PreviewSelect key={f.label} label={f.label} placeholder={f.placeholder} options={f.options} />
          ) : (
            <FormField key={f.label} field={f} />
          ),
        )}
      </div>
    </Card>
  );
}

function UploadPlaceholder({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-surface-2/30 px-4 py-8 text-center">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <p className="mt-2 text-[12px] text-muted-foreground">Drag and drop or browse — preview only</p>
      <button
        type="button"
        disabled
        className="mt-4 cursor-not-allowed rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
      >
        Choose file
      </button>
    </div>
  );
}

const companyFields: Field[] = [
  { label: "Company name", placeholder: "Harbor Logistics Group" },
  { label: "Desired ticker", placeholder: "HLOG" },
  {
    label: "Sector",
    placeholder: "Select sector",
    type: "select",
    options: ["Energy", "Financials", "Industrials", "Healthcare", "Consumer", "Materials", "Utilities", "Telecom"],
  },
  { label: "Founder / CEO", placeholder: "Full name" },
  { label: "Headquarters", placeholder: "Newport Harbor District" },
  {
    label: "Company description",
    placeholder: "Brief description of the business, operations, and market position…",
    type: "textarea",
    span: 2,
  },
];

const financialFields: Field[] = [
  { label: "Estimated company value", placeholder: "ƒ500M" },
  { label: "Shares to issue", placeholder: "5,000,000" },
  { label: "Proposed offering price", placeholder: "ƒ18.00" },
  { label: "Intended raise size", placeholder: "ƒ90M" },
  { label: "Current revenue / income estimate", placeholder: "ƒ42M annual revenue" },
  {
    label: "Existing shareholders",
    placeholder: "Founder 68%, Family Office 22%, Employee pool 10%",
    type: "textarea",
    span: 2,
  },
];

const listingFields: Field[] = [
  {
    label: "Reason for listing",
    placeholder: "Capital raise, liquidity, institutional visibility…",
    type: "textarea",
    span: 2,
  },
  {
    label: "Planned use of funds",
    placeholder: "Expansion, fleet acquisition, working capital…",
    type: "textarea",
    span: 2,
  },
  {
    label: "Desired listing timeline",
    placeholder: "Select timeline",
    type: "select",
    options: ["Q3 2026", "Q4 2026", "Q1 2027", "Flexible"],
  },
  { label: "Public float percentage", placeholder: "25%" },
  {
    label: "Dividend policy",
    placeholder: "Select policy",
    type: "select",
    options: ["No dividend planned", "Quarterly dividend", "Annual dividend", "To be determined"],
  },
];

const contactFields: Field[] = [
  { label: "Contact name", placeholder: "Primary listing contact" },
  { label: "Discord username", placeholder: "username" },
  { label: "Minecraft username", placeholder: "In-game name" },
  {
    label: "Preferred contact method",
    placeholder: "Select method",
    type: "select",
    options: ["Discord", "In-game", "Alta Terminal message", "Email on file"],
  },
];

export function ListingApplicationForm() {
  return (
    <div className="space-y-6">
      <FormSection title="Company Information" fields={companyFields} />
      <FormSection title="Financial Information" fields={financialFields} />
      <FormSection title="Listing Details" fields={listingFields} />

      <Card>
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Documents</div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <UploadPlaceholder label="Prospectus" />
          <UploadPlaceholder label="Financial statement" />
          <UploadPlaceholder label="Ownership statement" />
        </div>
      </Card>

      <FormSection title="Review Preferences" fields={contactFields} />

      <Card className="border-gold/30 bg-gold/5">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Applications are reviewed manually. Submission is simulated in this preview.
        </p>
      </Card>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-md border border-border bg-surface-2 px-5 py-2.5 text-[13px] font-medium text-muted-foreground"
        >
          Save Draft (preview only)
        </button>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-md bg-foreground/40 px-5 py-2.5 text-[13px] font-medium text-background/70"
        >
          Submit for Review (preview only)
        </button>
      </div>
    </div>
  );
}
