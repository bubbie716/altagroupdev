/**
 * Entity alias normalization for Admin Copilot resolution.
 */
export function normalizeEntityAlias(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[@#]+/, "")
    .replace(/['’]s\b/g, "")
    .replace(/[^a-z0-9._-]+/g, "")
    .slice(0, 64);
}

export function aliasesMatch(candidate: string | null | undefined, queryAlias: string): boolean {
  if (!candidate) return false;
  const a = normalizeEntityAlias(candidate);
  const b = normalizeEntityAlias(queryAlias);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/** Operator-facing empty-lookup copy. */
export function notFoundMessageForSubject(subject: string | null | undefined): string {
  const cleaned = subject?.trim().replace(/^["']|["']$/g, "");
  if (cleaned && cleaned.length >= 2) {
    return `Couldn't find "${cleaned}".`;
  }
  return "Couldn't find a matching authorized record.";
}

/** Extract a person/company query phrase from common open/show/balance commands. */
export function extractSubjectFromCommand(text: string): string | null {
  const t = text.trim();
  const patterns = [
    /(?:what\s+(?:is|are)|show|find|get)\s+(.+?)(?:'s|’s)\s+(?:total\s+)?(?:bank\s+)?(?:balances?|accounts?|loans?|deal\s*room|latest\s+transfer|customer\s+record|record)/i,
    /(?:open|show|find|get)\s+(.+?)(?:'s|’s)\s+(?:deal\s*room|accounts?|loans?|latest\s+transfer|customer\s+record|record)/i,
    /(?:open|show)\s+(?:the\s+)?customer\s+record\s+for\s+(.+)$/i,
    /(?:open|show)\s+(.+?)(?:'s|’s)\s+/i,
    /(.+?)(?:'s|’s)\s+(?:total\s+)?(?:bank\s+)?balances?\b/i,
    /for\s+([A-Za-z0-9._-]{2,})$/i,
  ];
  for (const p of patterns) {
    const m = t.match(p);
    if (m?.[1]) {
      const subject = m[1].replace(/^(the|a|an)\s+/i, "").trim();
      if (subject.length >= 2 && subject.length <= 64) return subject;
    }
  }
  return null;
}

export function commandWantsOpen(text: string): boolean {
  return /\b(open|go\s+to|take\s+me\s+to|navigate\s+to)\b/i.test(text);
}

export function commandMentionsDealRoom(text: string): boolean {
  return /\bdeal[\s-]?room\b/i.test(text);
}

export function commandMentionsAccounts(text: string): boolean {
  return /\baccounts?\b/i.test(text);
}

export function commandMentionsLoans(text: string): boolean {
  return /\bloans?\b/i.test(text);
}

export function commandMentionsTransfer(text: string): boolean {
  return /\btransfers?\b|\blatest\s+transfer\b/i.test(text);
}

export function commandMentionsCustomerRecord(text: string): boolean {
  return /\bcustomer\s+record\b|\bcustomer\b/i.test(text) && /\b(open|show)\b/i.test(text);
}

export function commandMentionsFailed(text: string): boolean {
  return /\bfailed\b|\bfailures?\b|\berrors?\s+today\b/i.test(text);
}

export function commandMentionsDiscordDeadLetter(text: string): boolean {
  return /\bdead[\s-]?letter\b/i.test(text) && /\bdiscord\b/i.test(text);
}

export function commandMentionsTerminalOrder(text: string): boolean {
  return /\bterminal\b/i.test(text) && /\border\b/i.test(text);
}
