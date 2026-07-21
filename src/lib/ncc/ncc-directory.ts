import { maskAccountIdentifierForDisplay } from "@/lib/ncc/ncc-account-number";

export type DirectoryCsvRow = {
  accountIdentifier: string;
  participantAccountReference: string;
  currency: string;
  status: "ACTIVE" | "CLOSED" | "FROZEN";
  canDebit: boolean;
  canCredit: boolean;
  beneficiaryLabel?: string | null;
};

export type DirectoryValidationResult = {
  validRows: DirectoryCsvRow[];
  rejected: Array<{ line: number; reason: string }>;
  duplicates: string[];
  counts: {
    total: number;
    valid: number;
    rejected: number;
    duplicates: number;
  };
};

const FORBIDDEN_HEADERS = new Set([
  "balance",
  "password",
  "secret",
  "ssn",
  "taxid",
  "tax_id",
  "fullssn",
]);

function parseBool(value: string, field: string): boolean {
  const v = value.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes" || v === "y") return true;
  if (v === "false" || v === "0" || v === "no" || v === "n") return false;
  throw new Error(`Invalid boolean for ${field}`);
}

/** Minimal CSV parser — preserves quoted fields and leading zeros (string-only). */
export function parseDirectoryCsv(content: string): {
  headers: string[];
  rows: Array<Record<string, string>>;
} {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]!).map((h) => h.trim());
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]!);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export function validateDirectoryRows(
  headers: string[],
  rows: Array<Record<string, string>>,
  expectedCurrency = "FLR",
): DirectoryValidationResult {
  for (const h of headers) {
    if (FORBIDDEN_HEADERS.has(h.trim().toLowerCase())) {
      return {
        validRows: [],
        rejected: [{ line: 1, reason: `Forbidden column: ${h}` }],
        duplicates: [],
        counts: { total: rows.length, valid: 0, rejected: rows.length, duplicates: 0 },
      };
    }
  }

  const required = [
    "accountIdentifier",
    "participantAccountReference",
    "currency",
    "status",
    "canDebit",
    "canCredit",
  ];
  for (const r of required) {
    if (!headers.includes(r)) {
      return {
        validRows: [],
        rejected: [{ line: 1, reason: `Missing required column: ${r}` }],
        duplicates: [],
        counts: { total: rows.length, valid: 0, rejected: rows.length, duplicates: 0 },
      };
    }
  }

  const seen = new Map<string, number>();
  const duplicates: string[] = [];
  const validRows: DirectoryCsvRow[] = [];
  const rejected: Array<{ line: number; reason: string }> = [];

  rows.forEach((row, idx) => {
    const line = idx + 2;
    try {
      const accountIdentifier = String(row.accountIdentifier ?? "");
      const participantAccountReference = String(row.participantAccountReference ?? "");
      if (!accountIdentifier || accountIdentifier !== accountIdentifier.trim()) {
        throw new Error("accountIdentifier required (no leading/trailing whitespace)");
      }
      if (accountIdentifier.length > 64) throw new Error("accountIdentifier too long");
      if (!participantAccountReference.trim()) throw new Error("participantAccountReference required");
      if (participantAccountReference.length > 128) throw new Error("participantAccountReference too long");

      const currency = String(row.currency ?? "").trim().toUpperCase();
      if (currency !== expectedCurrency) throw new Error(`Unsupported currency ${currency}`);

      const statusRaw = String(row.status ?? "").trim().toUpperCase();
      if (statusRaw !== "ACTIVE" && statusRaw !== "CLOSED" && statusRaw !== "FROZEN") {
        throw new Error(`Invalid status ${statusRaw}`);
      }

      const canDebit = parseBool(String(row.canDebit ?? ""), "canDebit");
      const canCredit = parseBool(String(row.canCredit ?? ""), "canCredit");
      const beneficiaryLabel = row.beneficiaryLabel?.trim()
        ? row.beneficiaryLabel.trim().slice(0, 120)
        : null;

      if (seen.has(accountIdentifier)) {
        duplicates.push(accountIdentifier);
        rejected.push({ line, reason: "Duplicate accountIdentifier in upload" });
        return;
      }
      seen.set(accountIdentifier, line);

      validRows.push({
        accountIdentifier,
        participantAccountReference: participantAccountReference.trim(),
        currency,
        status: statusRaw,
        canDebit,
        canCredit,
        beneficiaryLabel,
      });
    } catch (e) {
      rejected.push({
        line,
        reason: e instanceof Error ? e.message : "Invalid row",
      });
    }
  });

  return {
    validRows,
    rejected,
    duplicates,
    counts: {
      total: rows.length,
      valid: validRows.length,
      rejected: rejected.length,
      duplicates: duplicates.length,
    },
  };
}

export function maskDirectoryIdentifier(accountIdentifier: string): string {
  return maskAccountIdentifierForDisplay(accountIdentifier);
}
