import { createServerFn } from "@tanstack/react-start";
import { AccountingAccessError } from "@/server/accounting/accounting.service";

function mapError(error: unknown): never {
  if (error instanceof AccountingAccessError) {
    throw new Error(error.message);
  }
  throw error instanceof Error ? error : new Error("Accounting request failed");
}

export const fetchAccountingWorkspace = createServerFn({ method: "GET" }).handler(async () => {
  const { getAccountingWorkspace } = await import("@/server/accounting/accounting.service");
  try {
    return await getAccountingWorkspace();
  } catch (error) {
    mapError(error);
  }
});

export const setAccountingCompanyFn = createServerFn({ method: "POST" })
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data }) => {
    const { setActiveAccountingCompany } = await import(
      "@/server/accounting/accounting.service"
    );
    try {
      return await setActiveAccountingCompany(data.companyId);
    } catch (error) {
      mapError(error);
    }
  });

export const listAccountingEntriesFn = createServerFn({ method: "GET" })
  .inputValidator((data: { month: string }) => data)
  .handler(async ({ data }) => {
    const { listLedgerEntries } = await import("@/server/accounting/accounting.service");
    try {
      return await listLedgerEntries(data.month);
    } catch (error) {
      mapError(error);
    }
  });

export const createAccountingEntryFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      date: string;
      type: string;
      amountCents: number;
      categoryId: string;
      counterpartyId?: string | null;
      paymentMethod: string;
      note?: string | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { createLedgerEntry } = await import("@/server/accounting/accounting.service");
    try {
      return await createLedgerEntry(data);
    } catch (error) {
      mapError(error);
    }
  });

export const deleteAccountingEntryFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { deleteLedgerEntry } = await import("@/server/accounting/accounting.service");
    try {
      return await deleteLedgerEntry(data.id);
    } catch (error) {
      mapError(error);
    }
  });

export const listAccountingCategoriesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { listCategories } = await import("@/server/accounting/accounting.service");
  try {
    return await listCategories();
  } catch (error) {
    mapError(error);
  }
});

export const createAccountingCategoryFn = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string; kind: string }) => data)
  .handler(async ({ data }) => {
    const { createCategory } = await import("@/server/accounting/accounting.service");
    try {
      return await createCategory(data);
    } catch (error) {
      mapError(error);
    }
  });

export const updateAccountingCategoryFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; name: string; kind: string }) => data)
  .handler(async ({ data }) => {
    const { updateCategory } = await import("@/server/accounting/accounting.service");
    try {
      return await updateCategory(data);
    } catch (error) {
      mapError(error);
    }
  });

export const deleteAccountingCategoryFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { deleteCategory } = await import("@/server/accounting/accounting.service");
    try {
      return await deleteCategory(data.id);
    } catch (error) {
      mapError(error);
    }
  });

export const seedAccountingCategoriesFn = createServerFn({ method: "POST" }).handler(async () => {
  const { seedDefaultCategories } = await import("@/server/accounting/accounting.service");
  try {
    return await seedDefaultCategories();
  } catch (error) {
    mapError(error);
  }
});

export const listAccountingCounterpartiesFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { listCounterparties } = await import("@/server/accounting/accounting.service");
    try {
      return await listCounterparties();
    } catch (error) {
      mapError(error);
    }
  },
);

export const createAccountingCounterpartyFn = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string; kind: string }) => data)
  .handler(async ({ data }) => {
    const { createCounterparty } = await import("@/server/accounting/accounting.service");
    try {
      return await createCounterparty(data);
    } catch (error) {
      mapError(error);
    }
  });

export const updateAccountingCounterpartyFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; name: string; kind: string }) => data)
  .handler(async ({ data }) => {
    const { updateCounterparty } = await import("@/server/accounting/accounting.service");
    try {
      return await updateCounterparty(data);
    } catch (error) {
      mapError(error);
    }
  });

export const deleteAccountingCounterpartyFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { deleteCounterparty } = await import("@/server/accounting/accounting.service");
    try {
      return await deleteCounterparty(data.id);
    } catch (error) {
      mapError(error);
    }
  });

export const exportAccountingCsvFn = createServerFn({ method: "GET" })
  .inputValidator((data: { month: string }) => data)
  .handler(async ({ data }) => {
    const { buildLedgerCsv } = await import("@/server/accounting/accounting.service");
    try {
      return await buildLedgerCsv(data.month);
    } catch (error) {
      mapError(error);
    }
  });
