import { AltaTerminalInstitutionAdapter } from "@/server/ncc/adapters/alta-terminal.adapter";

/**
 * @deprecated Sprint 4G — Alta Exchange is retired. Kept on disk for historical
 * reference only. Not registered in institution-adapter.registry (no new transfers).
 *
 * Historically shared the Terminal cash SoR (TerminalCashAccount / TerminalCashEntry);
 * institutionKey "alta-exchange" was used for adapter resolution / audit only.
 */
export class AltaExchangeInstitutionAdapter extends AltaTerminalInstitutionAdapter {
  constructor() {
    super("alta-exchange");
  }
}

export { AltaTerminalInstitutionAdapter };
