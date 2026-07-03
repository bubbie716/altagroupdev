const ACCOUNT_NUMBER_PATTERN = /\bAB-\d{4}-\d{6}\b/gi;
const CARD_NUMBER_PATTERN = /\b(?:\d[ -]?){13,19}\b/g;
const LONG_TOKEN_PATTERN = /\b[A-Za-z0-9_-]{40,}\b/g;

export function maskAccountNumber(accountNumber: string): string {
  const normalized = accountNumber.trim().toUpperCase();
  const match = normalized.match(/^AB-(\d{4})-(\d{6})$/);
  if (!match) return "AB-****-******";
  return `AB-${match[1]}-**${match[2].slice(-2)}`;
}

export function sanitizeStaffAuditDetails(details: string | string[] | undefined): string | null {
  if (!details) return null;

  const joined = (Array.isArray(details) ? details : [details])
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ");

  if (!joined) return null;

  let sanitized = joined
    .replace(ACCOUNT_NUMBER_PATTERN, (value) => maskAccountNumber(value))
    .replace(CARD_NUMBER_PATTERN, "****")
    .replace(LONG_TOKEN_PATTERN, "[redacted]")
    .replace(/https?:\/\/\S+/g, "[link]")
    .replace(/\s+/g, " ")
    .trim();

  if (sanitized.length > 500) {
    sanitized = `${sanitized.slice(0, 497)}...`;
  }

  return sanitized || null;
}
