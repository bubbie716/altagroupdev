import { prisma } from "@/server/db";
import { AltaBankInstitutionAdapter } from "@/server/ncc/adapters/alta-bank.adapter";
import { AltaTerminalInstitutionAdapter } from "@/server/ncc/adapters/alta-terminal.adapter";
import { ExternalParticipantAdapter } from "@/server/ncc/adapters/external-participant.adapter";
import type { InstitutionAdapter, InstitutionAdapterKey } from "@/server/ncc/institution-adapter";
import {
  ALTA_BANK_INSTITUTION_ID,
  ALTA_EXCHANGE_INSTITUTION_ID,
  ALTA_TERMINAL_INSTITUTION_ID,
} from "@/lib/bank/account-ownership";

/** Live adapters only — Alta Exchange is retired and intentionally unregistered. */
const adapters = new Map<InstitutionAdapterKey, InstitutionAdapter>([
  ["alta-bank", new AltaBankInstitutionAdapter()],
  ["alta-terminal", new AltaTerminalInstitutionAdapter()],
]);

/**
 * Historical ID → key map (includes retired Alta Exchange for resolution only).
 * `"alta-exchange"` has no registered adapter — getAdapterForInstitution returns null.
 */
const INSTITUTION_ID_TO_KEY: Record<string, InstitutionAdapterKey> = {
  [ALTA_BANK_INSTITUTION_ID]: "alta-bank",
  [ALTA_TERMINAL_INSTITUTION_ID]: "alta-terminal",
  [ALTA_EXCHANGE_INSTITUTION_ID]: "alta-exchange",
};

export function registerInstitutionAdapter(adapter: InstitutionAdapter): void {
  adapters.set(adapter.institutionKey, adapter);
}

export function getInstitutionAdapter(key: InstitutionAdapterKey): InstitutionAdapter | null {
  return adapters.get(key) ?? null;
}

export function resolveInstitutionAdapterKey(institution: {
  id: string;
  slug: string;
  isAlta: boolean;
}): InstitutionAdapterKey {
  if (INSTITUTION_ID_TO_KEY[institution.id]) return INSTITUTION_ID_TO_KEY[institution.id];
  if (institution.slug === "alta-bank" || (institution.isAlta && institution.slug.includes("bank"))) {
    return "alta-bank";
  }
  // Alta Exchange is retired — do not resolve slug "exchange" to a live adapter key
  // for new work. Historical ID still maps via INSTITUTION_ID_TO_KEY above.
  if (institution.slug.includes("terminal")) return "alta-terminal";
  return institution.slug;
}

/**
 * Resolve the institution adapter. Non-Alta institutions receive the external
 * participant adapter only when a non-draft connector is configured.
 * Alta Exchange always returns null (retired — no new transfers).
 */
export async function getAdapterForInstitution(institution: {
  id: string;
  slug: string;
  isAlta: boolean;
}): Promise<InstitutionAdapter | null> {
  if (institution.id === ALTA_EXCHANGE_INSTITUTION_ID) return null;

  const key = resolveInstitutionAdapterKey(institution);
  const registered = getInstitutionAdapter(key);
  if (registered) return registered;
  if (!institution.isAlta) {
    const connector = await prisma.nccParticipantConnector.findUnique({
      where: { institutionId: institution.id },
      select: { status: true },
    });
    if (connector && connector.status !== "DISABLED" && connector.status !== "DRAFT") {
      return new ExternalParticipantAdapter(institution.id, key);
    }
  }
  return null;
}
