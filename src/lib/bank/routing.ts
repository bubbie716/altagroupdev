/** Alta Bank routing number — shared by all Alta Bank accounts until NCC institution routing. */
export const ALTA_BANK_ROUTING_NUMBER = "011000001";

export function getRoutingNumber(): string {
  return ALTA_BANK_ROUTING_NUMBER;
}
