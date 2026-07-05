export type PaymentEngineFundingSource =
  | { kind: "bank_account"; accountId: string }
  | { kind: "alta_card"; cardId: string };
