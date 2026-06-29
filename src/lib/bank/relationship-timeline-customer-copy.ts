import { florin } from "@/lib/bank/api";
import { altaCardTierLabel } from "@/lib/bank/alta-card-types";
import { COMPANY_RELATIONSHIP_TIER_LABELS, COMPANY_RELATIONSHIP_TIER_THRESHOLDS } from "@/lib/bank/company-relationship-intelligence-config";
import { RELATIONSHIP_TIER_LABELS, RELATIONSHIP_TIER_THRESHOLDS } from "@/lib/bank/relationship-intelligence-config";

export type CustomerTimelineScope = "personal" | "business";

export type TimelineCopy = {
  title: string;
  description: string | null;
};

export type TimelineRowForEnrichment = {
  id?: string;
  eventType: string;
  title: string;
  description: string | null;
  occurredAt: string;
  relatedEntityId: string | null;
  metadata: Record<string, unknown> | null;
};

export function extractTierPairFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): { previousTier: string | null; newTier: string | null } {
  if (!metadata) return { previousTier: null, newTier: null };
  const previousTier =
    typeof metadata.previousTier === "string"
      ? metadata.previousTier
      : typeof metadata.oldTier === "string"
        ? metadata.oldTier
        : typeof metadata.oldValue === "string"
          ? metadata.oldValue
          : null;
  const newTier =
    typeof metadata.newTier === "string"
      ? metadata.newTier
      : typeof metadata.newValue === "string"
        ? metadata.newValue
        : null;
  return { previousTier, newTier };
}

export function extractNewRelationshipTier(
  row: TimelineRowForEnrichment,
  tierLabels: Record<string, string>,
): string | null {
  const fromMeta = extractTierPairFromMetadata(row.metadata);
  if (fromMeta.newTier) return fromMeta.newTier;

  for (const [code, label] of Object.entries(tierLabels)) {
    if (row.title.includes(label)) return code;
    if (row.title.toUpperCase().includes(code)) return code;
  }

  const toMatch = row.title.match(/(?:upgraded|changed|reached) to\s+(.+?)$/i);
  if (toMatch) {
    const fragment = toMatch[1].trim();
    for (const [code, label] of Object.entries(tierLabels)) {
      if (fragment.toLowerCase() === label.toLowerCase()) return code;
      if (fragment.toUpperCase() === code) return code;
    }
  }

  if (row.description) {
    for (const [code, label] of Object.entries(tierLabels)) {
      if (new RegExp(`\\b${label}\\b`, "i").test(row.description)) return code;
    }
  }

  return null;
}

const AWKWARD_DESCRIPTION =
  /^(Previously|Your previous tier was|Previous tier:|Crossed\b)|\b(based on profile history|profile recalculated|snapshot refreshed|timeline synchronized|event recorded|cron refresh|audit synchronization|recommendation refreshed)\b|(?:increased|changed|upgraded) from .+ to |^[\d,]+(?:\.\d{2})?$|(?:^Your\s+){2,}|(?:\bis now active\.?\s*){2,}/i;

function tierLabelsForScope(scope: CustomerTimelineScope): Record<string, string> {
  return scope === "business" ? COMPANY_RELATIONSHIP_TIER_LABELS : RELATIONSHIP_TIER_LABELS;
}

function parseFlorinAmount(text: string): number | null {
  const match = text.match(/[\d,]+(?:\.\d{2})?/);
  if (!match) return null;
  const parsed = Number(match[0].replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function milestoneThreshold(row: TimelineRowForEnrichment): number | null {
  const meta = row.metadata;
  if (typeof meta?.threshold === "number" && Number.isFinite(meta.threshold)) {
    return meta.threshold;
  }
  const fromTitle = parseFlorinAmount(row.title);
  if (fromTitle != null) return fromTitle;
  if (row.description) return parseFlorinAmount(row.description);
  return null;
}

function isTotalAssetsMilestone(row: TimelineRowForEnrichment): boolean {
  if (row.metadata?.milestoneKind === "TOTAL_ALTA_ASSETS") return true;
  return /total alta assets|total relationship/i.test(row.title);
}

function accountDescription(accountName: string | null, business: boolean): string {
  if (business) return "Your business banking relationship is now active.";

  const trimmed = extractBankAccountName(accountName);
  if (trimmed && /checking/i.test(trimmed)) return "Your checking account is now active.";
  if (trimmed && /savings/i.test(trimmed)) return "Your savings account is now active.";
  if (trimmed) return `Your ${trimmed} account is now active.`;
  return "Your account is now active.";
}

/** Recover a plain account label from stored name or corrupted refresh-loop descriptions. */
export function extractBankAccountName(
  raw: string | null | undefined,
  metadata?: Record<string, unknown> | null,
): string | null {
  if (typeof metadata?.accountName === "string" && metadata.accountName.trim()) {
    return metadata.accountName.trim();
  }
  if (!raw?.trim()) return null;

  let text = raw.trim();
  if (!/^Your\s/i.test(text) && !/\bis now active\b/i.test(text)) {
    return text;
  }

  text = text.replace(/^(Your\s+)+/i, "");
  text = text.replace(/(\s+is now active\.?\s*)+$/gi, "").trim();
  return text || null;
}

export function extractBankAccountNameFromRow(row: TimelineRowForEnrichment): string | null {
  return extractBankAccountName(row.description, row.metadata);
}

function isAwkwardDescription(description: string | null | undefined): boolean {
  const trimmed = description?.trim();
  if (!trimmed) return true;
  return AWKWARD_DESCRIPTION.test(trimmed);
}

/** Strip database-style or legacy awkward descriptions before display. */
export function sanitizeCustomerTimelineCopy(copy: TimelineCopy): TimelineCopy {
  if (isAwkwardDescription(copy.description)) {
    return { title: copy.title, description: null };
  }
  return { title: copy.title, description: copy.description?.trim() ?? null };
}

export function formatRelationshipEstablishedCopy(scope: CustomerTimelineScope): TimelineCopy {
  if (scope === "business") {
    return {
      title: "Business Relationship Established",
      description: "Your business banking relationship with Alta began.",
    };
  }
  return {
    title: "Relationship Established",
    description: "Your relationship with Alta began.",
  };
}

export function formatBankAccountOpenedCopy(
  accountName: string | null,
  scope: CustomerTimelineScope,
  metadata?: Record<string, unknown> | null,
): TimelineCopy {
  const business = scope === "business";
  return {
    title: business ? "Business Account Opened" : "Bank Account Opened",
    description: accountDescription(extractBankAccountName(accountName, metadata), business),
  };
}

export function formatDepositMilestoneCopy(
  threshold: number,
  scope: CustomerTimelineScope,
): TimelineCopy {
  const amount = florin(threshold);
  if (scope === "business") {
    return {
      title: "Relationship Milestone Reached",
      description: `Your company's total deposits with Alta reached ${amount}.`,
    };
  }
  return {
    title: "Relationship Milestone Reached",
    description: `Your total deposits with Alta reached ${amount}.`,
  };
}

export function formatWithdrawalMilestoneCopy(
  threshold: number,
  scope: CustomerTimelineScope,
): TimelineCopy {
  const amount = florin(threshold);
  if (scope === "business") {
    return {
      title: "Relationship Milestone Reached",
      description: `Your company's total withdrawals with Alta reached ${amount}.`,
    };
  }
  return {
    title: "Relationship Milestone Reached",
    description: `Your total withdrawals with Alta reached ${amount}.`,
  };
}

export function formatAltaPayMilestoneCopy(
  threshold: number,
  scope: CustomerTimelineScope,
): TimelineCopy {
  const amount = florin(threshold);
  if (scope === "business") {
    return {
      title: "Relationship Milestone Reached",
      description: `Your company's Alta Pay activity reached ${amount}.`,
    };
  }
  return {
    title: "Relationship Milestone Reached",
    description: `Your Alta Pay activity reached ${amount}.`,
  };
}

export function formatTotalAltaAssetsMilestoneCopy(threshold: number): TimelineCopy {
  const amount = florin(threshold);
  return {
    title: "Relationship Milestone Reached",
    description: `Your total relationship with Alta reached ${amount}.`,
  };
}

export function formatAltaCardPaidOnTimeCopy(scope: CustomerTimelineScope): TimelineCopy {
  if (scope === "business") {
    return {
      title: "Alta Card Payment Received",
      description: "Your business Alta Card payment was received.",
    };
  }
  return {
    title: "Alta Card Payment Received",
    description: "Your Alta Card payment was received.",
  };
}

export function formatLoanPaidOffCopy(scope: CustomerTimelineScope): TimelineCopy {
  if (scope === "business") {
    return {
      title: "Business Loan Fully Repaid",
      description: "Your business loan has been repaid in full.",
    };
  }
  return {
    title: "Loan Fully Repaid",
    description: "Your loan has been repaid in full.",
  };
}

export function formatPrivateBankingEligibleCopy(scope: CustomerTimelineScope): TimelineCopy {
  if (scope === "business") {
    return {
      title: "Commercial Banking Invitation Sent",
      description: "Your company is now eligible for Alta commercial banking.",
    };
  }
  return {
    title: "Alta Private Invitation Sent",
    description: "You are now eligible to join Alta Private.",
  };
}

export function formatPrivateBankingClientCopy(scope: CustomerTimelineScope): TimelineCopy {
  if (scope === "business") {
    return {
      title: "Commercial Banking Activated",
      description: "Your company's commercial banking relationship is now active.",
    };
  }
  return {
    title: "Alta Private Activated",
    description: "Welcome to Alta Private.",
  };
}

export function formatAltaCardOpenedCopy(scope: CustomerTimelineScope): TimelineCopy {
  if (scope === "business") {
    return {
      title: "Business Alta Card Opened",
      description: "Your business Alta Card is now active.",
    };
  }
  return {
    title: "Alta Card Opened",
    description: "Your Alta Card is now active.",
  };
}

export function formatAltaCardUpgradedCopy(
  newTier: string | null | undefined,
  scope: CustomerTimelineScope,
): TimelineCopy {
  const business = scope === "business";
  const newLabel = newTier ? altaCardTierLabel(newTier) : null;
  return {
    title: business ? "Business Alta Card Upgraded" : "Alta Card Upgraded",
    description: newLabel
      ? `Your ${business ? "business " : ""}Alta Card was upgraded to ${newLabel}.`.replace(
          "  ",
          " ",
        )
      : `Your ${business ? "business " : ""}Alta Card was upgraded.`.replace("  ", " "),
  };
}

export function formatLoanApprovedCopy(scope: CustomerTimelineScope): TimelineCopy {
  return {
    title: scope === "business" ? "Business Loan Approved" : "Loan Approved",
    description:
      scope === "business"
        ? "Your business loan was approved and funds were made available."
        : "Your loan was approved and funds were made available.",
  };
}

/** Outcome-focused tier copy — never describes internal migrations. */
export function formatRelationshipTierOutcomeCopy(
  newTier: string,
  tierLabels: Record<string, string>,
  scope: CustomerTimelineScope,
): TimelineCopy {
  const business = scope === "business";

  switch (newTier) {
    case "PRIVATE_CLIENT":
      return formatPrivateBankingClientCopy(scope);
    case "PRIVATE_ELIGIBLE":
      return formatPrivateBankingEligibleCopy(scope);
    case "COMMERCIAL_ELIGIBLE":
      return formatPrivateBankingEligibleCopy("business");
    case "PREMIER":
      return {
        title: "Premier Status Reached",
        description: business
          ? "Your company's relationship has reached Premier status."
          : "Your relationship has reached Premier status.",
      };
    case "PREFERRED":
      return {
        title: "Preferred Status Reached",
        description: business
          ? "Your company's relationship now qualifies for Preferred status."
          : "Your relationship now qualifies for Preferred status.",
      };
    case "STANDARD":
      return {
        title: "Standard Status Reached",
        description: business
          ? "Your company's relationship has reached Standard status."
          : "Your relationship has reached Standard status.",
      };
    case "NEW":
      return formatRelationshipEstablishedCopy(scope);
    default: {
      const label = tierLabels[newTier] ?? newTier;
      return {
        title: "Relationship Milestone Reached",
        description: business
          ? `Your company's relationship has reached ${label} status.`
          : `Your relationship has reached ${label} status.`,
      };
    }
  }
}

function resolveMilestoneCopy(row: TimelineRowForEnrichment, scope: CustomerTimelineScope): TimelineCopy | null {
  const threshold = milestoneThreshold(row);
  if (threshold == null) return null;

  if (isTotalAssetsMilestone(row)) {
    return formatTotalAltaAssetsMilestoneCopy(threshold);
  }
  if (
    row.eventType === "DEPOSIT_MILESTONE" ||
    /deposit/i.test(row.title) ||
    row.metadata?.milestoneKind === "DEPOSITS"
  ) {
    return formatDepositMilestoneCopy(threshold, scope);
  }
  if (row.eventType === "WITHDRAWAL_MILESTONE" || /withdrawal/i.test(row.title)) {
    return formatWithdrawalMilestoneCopy(threshold, scope);
  }
  if (row.eventType === "ALTA_PAY_MILESTONE" || /alta pay/i.test(row.title)) {
    return formatAltaPayMilestoneCopy(threshold, scope);
  }
  if (/milestone|reached/i.test(row.title)) {
    return formatTotalAltaAssetsMilestoneCopy(threshold);
  }
  return null;
}

function normalizeLegacyTitle(title: string, scope: CustomerTimelineScope): string {
  let normalized = title.trim();

  const replacements: Array<[RegExp, string]> = [
    [/^Joined Alta$/i, "Relationship Established"],
    [/^Relationship started$/i, "Relationship Established"],
    [/^Company relationship started$/i, "Business Relationship Established"],
    [/^Bank account opened$/i, "Bank Account Opened"],
    [/^Business bank account opened$/i, "Business Account Opened"],
    [/^Business account opened$/i, "Business Account Opened"],
    [/^Loan paid off$/i, scope === "business" ? "Business Loan Fully Repaid" : "Loan Fully Repaid"],
    [/^Business loan paid off$/i, "Business Loan Fully Repaid"],
    [/^Loan funded\b/i, "Loan Approved"],
    [/^Business loan funded\b/i, "Business Loan Approved"],
    [/^Loan approved \(.+/i, "Loan Approved"],
    [/^Business loan approved \(.+/i, "Business Loan Approved"],
    [/^Alta Card opened \(.+/i, "Alta Card Opened"],
    [/^Business Alta Card opened \(.+/i, "Business Alta Card Opened"],
    [/^Private banking eligibility reached$/i, "Private Banking Invitation Sent"],
    [/^Commercial banking eligibility reached$/i, "Commercial Banking Invitation Sent"],
    [/^Became Alta Private client$/i, "Alta Private Activated"],
    [/^Relationship tier (changed|upgraded) to/i, "Relationship tier upgraded to"],
    [/^Company relationship tier (changed|upgraded) to/i, "Company relationship tier upgraded to"],
    [/^Relationship Tier (Upgraded|Updated) to/i, "Relationship tier upgraded to"],
    [/^Alta Card tier upgraded to/i, "Alta Card Upgraded"],
    [/^Business Alta Card tier upgraded to/i, "Business Alta Card Upgraded"],
    [/^Alta Card Upgraded to/i, "Alta Card Upgraded"],
    [/^Lifetime deposits reached/i, "Relationship Milestone Reached"],
    [/^Lifetime withdrawals reached/i, "Relationship Milestone Reached"],
    [/^Alta Pay volume reached/i, "Relationship Milestone Reached"],
    [/^Total Alta assets reached/i, "Relationship Milestone Reached"],
    [/^Deposit Milestone Reached$/i, "Relationship Milestone Reached"],
    [/^Withdrawal Milestone Reached$/i, "Relationship Milestone Reached"],
    [/^Alta Pay Milestone Reached$/i, "Relationship Milestone Reached"],
  ];

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(normalized)) {
      normalized = normalized.replace(pattern, replacement);
      break;
    }
  }

  return normalized;
}

function inferCustomerTimelineDescription(
  row: TimelineRowForEnrichment,
  scope: CustomerTimelineScope,
  title: string,
): string | null {
  const tierLabels = tierLabelsForScope(scope);

  if (row.eventType === "RELATIONSHIP_TIER_CHANGED") {
    const newTier = extractNewRelationshipTier(row, tierLabels);
    if (newTier) return formatRelationshipTierOutcomeCopy(newTier, tierLabels, scope).description;
  }

  if (row.eventType === "ALTA_CARD_TIER_CHANGED") {
    const { newTier } = extractTierPairFromMetadata(row.metadata);
    return formatAltaCardUpgradedCopy(newTier, scope).description;
  }

  const milestone = resolveMilestoneCopy(row, scope);
  if (milestone?.description) return milestone.description;

  if (/^Relationship Established$/i.test(title)) {
    return formatRelationshipEstablishedCopy(scope).description;
  }
  if (/^Alta Private Activated$/i.test(title)) {
    return formatPrivateBankingClientCopy(scope).description;
  }
  if (/^Private Banking Invitation Sent$/i.test(title)) {
    return formatPrivateBankingEligibleCopy(scope).description;
  }
  if (/^Commercial Banking Invitation Sent$/i.test(title)) {
    return formatPrivateBankingEligibleCopy("business").description;
  }
  if (/^Loan Fully Repaid$/i.test(title) || /^Business Loan Fully Repaid$/i.test(title)) {
    return formatLoanPaidOffCopy(scope).description;
  }
  if (/^Loan Approved$/i.test(title) || /^Business Loan Approved$/i.test(title)) {
    return formatLoanApprovedCopy(scope).description;
  }
  if (/^Bank Account Opened$/i.test(title) || /^Business Account Opened$/i.test(title)) {
    return formatBankAccountOpenedCopy(row.description, scope, row.metadata).description;
  }
  if (/^Alta Card Upgraded$/i.test(title) || /^Business Alta Card Upgraded$/i.test(title)) {
    return formatAltaCardUpgradedCopy(extractTierPairFromMetadata(row.metadata).newTier, scope)
      .description;
  }
  if (/Preferred Status Reached$/i.test(title)) {
    return formatRelationshipTierOutcomeCopy("PREFERRED", tierLabels, scope).description;
  }
  if (/Premier Status Reached$/i.test(title)) {
    return formatRelationshipTierOutcomeCopy("PREMIER", tierLabels, scope).description;
  }
  if (/Standard Status Reached$/i.test(title)) {
    return formatRelationshipTierOutcomeCopy("STANDARD", tierLabels, scope).description;
  }
  if (/Relationship Milestone Reached$/i.test(title)) {
    return milestone?.description ?? null;
  }

  return null;
}

/** Sanitize awkward legacy text and refill missing descriptions for stored rows. */
export function polishCustomerTimelineCopy(
  row: TimelineRowForEnrichment,
  scope: CustomerTimelineScope,
  copy: TimelineCopy,
): TimelineCopy {
  const title = copy.title.trim();
  let description = copy.description?.trim() ?? null;
  if (isAwkwardDescription(description)) description = null;
  if (!description) {
    description = inferCustomerTimelineDescription(row, scope, title);
  }
  return { title, description };
}

/** Customer-facing copy for stored timeline rows (including legacy titles). */
export function resolveCustomerTimelineCopy(
  row: TimelineRowForEnrichment,
  scope: CustomerTimelineScope,
): TimelineCopy {
  const tierLabels = tierLabelsForScope(scope);
  let copy: TimelineCopy;

  switch (row.eventType) {
    case "RELATIONSHIP_STARTED":
      copy = formatRelationshipEstablishedCopy(scope);
      break;

    case "BANK_ACCOUNT_OPENED":
    case "BUSINESS_ACCOUNT_OPENED":
      copy = formatBankAccountOpenedCopy(row.description, scope, row.metadata);
      break;

    case "DEPOSIT_MILESTONE":
    case "WITHDRAWAL_MILESTONE":
    case "ALTA_PAY_MILESTONE": {
      const milestone = resolveMilestoneCopy(row, scope);
      copy = milestone ?? normalizeLegacyCustomerTimelineCopy(row, scope);
      break;
    }

    case "ALTA_CARD_PAID_ON_TIME":
      copy = formatAltaCardPaidOnTimeCopy(scope);
      break;

    case "LOAN_PAID_OFF":
      copy = formatLoanPaidOffCopy(scope);
      break;

    case "LOAN_FUNDED":
      copy = formatLoanApprovedCopy(scope);
      break;

    case "ALTA_CARD_OPENED":
      copy = formatAltaCardOpenedCopy(scope);
      break;

    case "ALTA_CARD_TIER_CHANGED": {
      const { newTier } = extractTierPairFromMetadata(row.metadata);
      copy = formatAltaCardUpgradedCopy(newTier, scope);
      break;
    }

    case "RELATIONSHIP_TIER_CHANGED": {
      const newTier = extractNewRelationshipTier(row, tierLabels);
      if (newTier === "PRIVATE_CLIENT") {
        copy = formatPrivateBankingClientCopy(scope);
        break;
      }
      if (newTier === "PRIVATE_ELIGIBLE") {
        copy = formatPrivateBankingEligibleCopy(scope);
        break;
      }
      copy = newTier
        ? formatRelationshipTierOutcomeCopy(newTier, tierLabels, scope)
        : normalizeLegacyCustomerTimelineCopy(row, scope);
      break;
    }

    case "PRIVATE_BANKING_ELIGIBLE":
    case "COMMERCIAL_BANKING_ELIGIBLE":
      copy = formatPrivateBankingEligibleCopy(scope);
      break;

    case "PRIVATE_BANKING_CLIENT":
      copy = formatPrivateBankingClientCopy(scope);
      break;

    default:
      copy = normalizeLegacyCustomerTimelineCopy(row, scope);
  }

  return polishCustomerTimelineCopy(row, scope, copy);
}

function normalizeLegacyCustomerTimelineCopy(
  row: TimelineRowForEnrichment,
  scope: CustomerTimelineScope,
): TimelineCopy {
  const title = normalizeLegacyTitle(row.title, scope);
  const tierLabels = tierLabelsForScope(scope);

  const milestone = resolveMilestoneCopy({ ...row, title }, scope);
  if (milestone) return milestone;

  const newTier = extractNewRelationshipTier({ ...row, title }, tierLabels);
  if (newTier && /relationship tier|status reached|milestone/i.test(title)) {
    return formatRelationshipTierOutcomeCopy(newTier, tierLabels, scope);
  }

  const cardTier = extractTierPairFromMetadata(row.metadata).newTier;
  if (cardTier || /alta card upgraded/i.test(title)) {
    return formatAltaCardUpgradedCopy(cardTier, scope);
  }

  if (/^Relationship Established$/i.test(title)) {
    return formatRelationshipEstablishedCopy(scope);
  }
  if (/^Alta Private Activated$/i.test(title)) {
    return formatPrivateBankingClientCopy(scope);
  }
  if (/^Private Banking Invitation Sent$/i.test(title)) {
    return formatPrivateBankingEligibleCopy(scope);
  }
  if (/^Loan Fully Repaid$/i.test(title) || /^Business Loan Fully Repaid$/i.test(title)) {
    return formatLoanPaidOffCopy(scope);
  }
  if (/^Loan Approved$/i.test(title) || /^Business Loan Approved$/i.test(title)) {
    return formatLoanApprovedCopy(scope);
  }
  if (/^Alta Card Opened$/i.test(title) || /^Business Alta Card Opened$/i.test(title)) {
    return formatAltaCardOpenedCopy(scope);
  }

  return { title, description: isAwkwardDescription(row.description) ? null : row.description };
}

export function isRelationshipTierUpgrade(
  previousTier: string | null,
  newTier: string,
  scope: CustomerTimelineScope,
): boolean {
  if (!previousTier) return true;
  const thresholds =
    scope === "business" ? COMPANY_RELATIONSHIP_TIER_THRESHOLDS : RELATIONSHIP_TIER_THRESHOLDS;
  const tierRank = (tier: string, table: Record<string, number>) =>
    tier in table ? table[tier] : 0;
  return tierRank(newTier, thresholds) > tierRank(previousTier, thresholds);
}
