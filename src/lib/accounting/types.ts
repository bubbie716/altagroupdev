export type AccountingOrgOption = {
  id: string;
  name: string;
};

export type AccountingCategoryDto = {
  id: string;
  name: string;
  kind: string;
};

export type AccountingCounterpartyDto = {
  id: string;
  name: string;
  kind: string;
};

export type AccountingLedgerEntryDto = {
  id: string;
  date: string;
  type: string;
  amountCents: number;
  paymentMethod: string;
  note: string | null;
  category: { id: string; name: string; kind: string };
  counterparty: { id: string; name: string; kind: string } | null;
};

export type AccountingWorkspaceDto = {
  orgId: string | null;
  orgName: string | null;
  orgs: AccountingOrgOption[];
};
