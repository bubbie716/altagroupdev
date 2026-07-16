import { AltaTerminalInstitutionAdapter } from "@/server/ncc/adapters/alta-terminal.adapter";

/**
 * Alta Exchange adapter — shares the same Alta trading-cash system of record
 * (TerminalCashAccount / TerminalCashEntry) as Alta Terminal. Exchange settlement
 * legs post against the identical ledger; only the institutionKey used for
 * adapter resolution / audit differs.
 */
export class AltaExchangeInstitutionAdapter extends AltaTerminalInstitutionAdapter {
  constructor() {
    super("alta-exchange");
  }
}

export { AltaTerminalInstitutionAdapter };
