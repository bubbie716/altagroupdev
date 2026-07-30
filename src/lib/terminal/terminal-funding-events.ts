/**
 * Domain event hooks for future Alta Bank / Terminal / Secretary bots.
 * This phase does not send Discord or any external messages.
 */

export type TerminalFundingDomainEventName =
  | "terminal_funding.bank_debit"
  | "terminal_funding.terminal_credit"
  | "terminal_funding.terminal_debit"
  | "terminal_funding.bank_credit"
  | "terminal_funding.failed"
  | "terminal_funding.completed";

export type TerminalFundingDomainEvent = {
  name: TerminalFundingDomainEventName;
  transferId: string;
  referenceCode: string;
  direction: "BANK_TO_TERMINAL" | "TERMINAL_TO_BANK";
  amount: number;
  bankAccountId: string;
  portfolioId: string;
  ownerUserId: string | null;
  ownerCompanyId: string | null;
  occurredAt: string;
};

type Listener = (event: TerminalFundingDomainEvent) => void;

const listeners = new Set<Listener>();

/** Register a listener (tests / future bot bridges). */
export function onTerminalFundingDomainEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitTerminalFundingDomainEvent(event: TerminalFundingDomainEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      /* never break the funding path */
    }
  }
}
