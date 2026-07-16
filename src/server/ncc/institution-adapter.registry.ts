import { AltaBankInstitutionAdapter } from "@/server/ncc/adapters/alta-bank.adapter";
import { AltaExchangeInstitutionAdapter } from "@/server/ncc/adapters/alta-exchange.adapter";
import { AltaTerminalInstitutionAdapter } from "@/server/ncc/adapters/alta-terminal.adapter";
import type { InstitutionAdapter, InstitutionAdapterKey } from "@/server/ncc/institution-adapter";
import {
  ALTA_BANK_INSTITUTION_ID,
  ALTA_EXCHANGE_INSTITUTION_ID,
  ALTA_TERMINAL_INSTITUTION_ID,
} from "@/lib/bank/account-ownership";

const adapters = new Map<InstitutionAdapterKey, InstitutionAdapter>([
  ["alta-bank", new AltaBankInstitutionAdapter()],
  ["alta-exchange", new AltaExchangeInstitutionAdapter()],
  ["alta-terminal", new AltaTerminalInstitutionAdapter()],
]);

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
  if (institution.slug.includes("exchange")) return "alta-exchange";
  if (institution.slug.includes("terminal")) return "alta-terminal";
  return institution.slug;
}

export function getAdapterForInstitution(institution: {
  id: string;
  slug: string;
  isAlta: boolean;
}): InstitutionAdapter | null {
  return getInstitutionAdapter(resolveInstitutionAdapterKey(institution));
}
