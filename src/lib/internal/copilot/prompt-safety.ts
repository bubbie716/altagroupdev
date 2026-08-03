/**
 * Prompt-injection hardening for untrusted record text.
 * Treat DB content as data never as instructions.
 */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(all\s+)?(previous|system)\s+prompts?/i,
  /system\s*:\s*/i,
  /<\s*\/?\s*system\s*>/i,
  /you\s+are\s+now\s+/i,
  /override\s+(safety|policy|permissions)/i,
  /exfiltrat(e|ion)/i,
  /reveal\s+(api|secret|token|key)/i,
];

export function sanitizeUntrustedRecordText(input: string | null | undefined, maxLen = 280): string {
  if (!input) return "";
  let text = String(input).replace(/\s+/g, " ").trim();
  for (const pattern of INJECTION_PATTERNS) {
    text = text.replace(pattern, "[redacted]");
  }
  // Strip ASCII control characters (eslint: avoid control-regex literal)
  text = [...text].filter((ch) => {
    const code = ch.charCodeAt(0);
    return code >= 32 || code === 9 || code === 10;
  }).join("");
  if (text.length > maxLen) text = `${text.slice(0, maxLen - 1)}…`;
  return text;
}

export function containsPromptInjectionAttempt(input: string | null | undefined): boolean {
  if (!input) return false;
  return INJECTION_PATTERNS.some((p) => p.test(input));
}

/** Wrap untrusted content so planners treat it as data. */
export function wrapUntrustedDataBlock(label: string, value: string): string {
  const safe = sanitizeUntrustedRecordText(value, 400);
  return `[UNTRUSTED_DATA ${label}] ${safe} [/UNTRUSTED_DATA]`;
}
