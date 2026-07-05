import { createServerFn } from "@tanstack/react-start";
import type {
  CreateMerchantInvoiceInput,
  PayMerchantInvoiceInput,
  UpdateMerchantInvoiceDraftInput,
} from "@/lib/bank/merchant-invoice-types";
import type { MerchantInvoiceStatus } from "@prisma/client";

async function actor() {
  const { requireAuth } = await import("@/server/auth.service");
  return requireAuth();
}

function rethrowServiceError(error: unknown): never {
  if (error instanceof Error) {
    if (error.message.startsWith("BAD_REQUEST:")) {
      throw new Error(error.message.slice("BAD_REQUEST:".length));
    }
    if (error.message.startsWith("CONFLICT:")) {
      throw new Error(error.message.slice("CONFLICT:".length));
    }
    if (error.message === "FORBIDDEN") throw new Error("You don't have permission to do that.");
    if (error.message === "NOT_FOUND") throw new Error("Invoice not found.");
  }
  throw error;
}

export const searchInvoiceRecipientsForMerchant = createServerFn({ method: "GET" })
  .inputValidator((input: { query: string; companyId?: string }) => input)
  .handler(async ({ data }) => {
    await actor();
    const { searchInvoiceRecipients } = await import("@/server/merchant-invoice.service");
    return searchInvoiceRecipients(data.query, data.companyId);
  });

export const fetchMerchantInvoiceDashboard = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { getMerchantInvoiceDashboard } = await import("@/server/merchant-invoice.service");
    try {
      return await getMerchantInvoiceDashboard(await actor(), companyId);
    } catch (error) {
      rethrowServiceError(error);
    }
  });

export const fetchMerchantInvoices = createServerFn({ method: "GET" })
  .inputValidator((input: { companyId: string; status?: MerchantInvoiceStatus }) => input)
  .handler(async ({ data }) => {
    const { listMerchantInvoices } = await import("@/server/merchant-invoice.service");
    try {
      return await listMerchantInvoices(await actor(), data.companyId, data.status);
    } catch (error) {
      rethrowServiceError(error);
    }
  });

export const fetchMerchantInvoiceDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { companyId: string; invoiceId: string }) => input)
  .handler(async ({ data }) => {
    const { getMerchantInvoiceDetail } = await import("@/server/merchant-invoice.service");
    try {
      return await getMerchantInvoiceDetail(await actor(), data.companyId, data.invoiceId);
    } catch (error) {
      rethrowServiceError(error);
    }
  });

export const createMerchantInvoiceDraftRecord = createServerFn({ method: "POST" })
  .inputValidator((input: CreateMerchantInvoiceInput) => input)
  .handler(async ({ data }) => {
    const { createMerchantInvoiceDraft } = await import("@/server/merchant-invoice.service");
    try {
      return await createMerchantInvoiceDraft(await actor(), data);
    } catch (error) {
      rethrowServiceError(error);
    }
  });

export const updateMerchantInvoiceDraftRecord = createServerFn({ method: "POST" })
  .inputValidator((input: UpdateMerchantInvoiceDraftInput) => input)
  .handler(async ({ data }) => {
    const { updateMerchantInvoiceDraft } = await import("@/server/merchant-invoice.service");
    try {
      return await updateMerchantInvoiceDraft(await actor(), data);
    } catch (error) {
      rethrowServiceError(error);
    }
  });

export const sendMerchantInvoiceRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { companyId: string; invoiceId: string }) => input)
  .handler(async ({ data }) => {
    const { sendMerchantInvoice } = await import("@/server/merchant-invoice.service");
    try {
      return await sendMerchantInvoice(await actor(), data.companyId, data.invoiceId);
    } catch (error) {
      rethrowServiceError(error);
    }
  });

export const cancelMerchantInvoiceRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { companyId: string; invoiceId: string }) => input)
  .handler(async ({ data }) => {
    const { cancelMerchantInvoice } = await import("@/server/merchant-invoice.service");
    try {
      return await cancelMerchantInvoice(await actor(), data.companyId, data.invoiceId);
    } catch (error) {
      rethrowServiceError(error);
    }
  });

export const remindMerchantInvoiceRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { companyId: string; invoiceId: string }) => input)
  .handler(async ({ data }) => {
    const { sendMerchantInvoiceReminder } = await import("@/server/merchant-invoice.service");
    try {
      return await sendMerchantInvoiceReminder(await actor(), data.companyId, data.invoiceId);
    } catch (error) {
      rethrowServiceError(error);
    }
  });

export const fetchReceivedInvoices = createServerFn({ method: "GET" }).handler(async () => {
  const { listReceivedInvoices } = await import("@/server/merchant-invoice.service");
  return listReceivedInvoices(await actor());
});

export const fetchUnreadReceivedInvoiceCount = createServerFn({ method: "GET" }).handler(async () => {
  const { countUnreadReceivedInvoices } = await import("@/server/merchant-invoice.service");
  return countUnreadReceivedInvoices(await actor());
});

export const fetchCustomerInvoice = createServerFn({ method: "GET" })
  .inputValidator((invoiceId: string) => invoiceId)
  .handler(async ({ data: invoiceId }) => {
    const { getCustomerInvoice, markMerchantInvoiceViewed } = await import(
      "@/server/merchant-invoice.service"
    );
    const user = await actor();
    try {
      await markMerchantInvoiceViewed(user, invoiceId);
    } catch {
      // viewed marking is best-effort
    }
    try {
      return await getCustomerInvoice(user, invoiceId);
    } catch (error) {
      rethrowServiceError(error);
    }
  });

export const quoteCustomerInvoicePayment = createServerFn({ method: "GET" })
  .inputValidator((invoiceId: string) => invoiceId)
  .handler(async ({ data: invoiceId }) => {
    const { quoteMerchantInvoicePayment } = await import(
      "@/server/merchant-invoice-payment.service"
    );
    try {
      return await quoteMerchantInvoicePayment(await actor(), invoiceId);
    } catch (error) {
      rethrowServiceError(error);
    }
  });

export const payCustomerInvoice = createServerFn({ method: "POST" })
  .inputValidator((input: PayMerchantInvoiceInput) => input)
  .handler(async ({ data }) => {
    const { payMerchantInvoice } = await import("@/server/merchant-invoice-payment.service");
    try {
      return await payMerchantInvoice(await actor(), data);
    } catch (error) {
      rethrowServiceError(error);
    }
  });

export const fetchPayFundingSourcesForInvoice = createServerFn({ method: "GET" })
  .inputValidator((invoiceId?: string) => invoiceId)
  .handler(async ({ data: invoiceId }) => {
    const user = await actor();
    const { listPayFundingSources } = await import("@/server/alta-pay.service");
    const sources = await listPayFundingSources(user);
    if (!invoiceId) return sources;

    const { prisma } = await import("@/server/db");
    const invoice = await prisma.merchantInvoice.findUnique({
      where: { id: invoiceId },
      select: { recipientCompanyId: true },
    });
    if (!invoice?.recipientCompanyId) return sources;

    const operating = await prisma.bankAccount.findFirst({
      where: {
        companyId: invoice.recipientCompanyId,
        accountType: "BUSINESS_OPERATING",
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (!operating) return [];

    return sources.filter((source) => {
      if (source.kind === "bank_account") return source.id === operating.id;
      return true;
    });
  });
