export type AccountingCompanyOption = {
  id: string;
  name: string;
  status: string;
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
  companyId: string | null;
  companyName: string | null;
  companies: AccountingCompanyOption[];
};
