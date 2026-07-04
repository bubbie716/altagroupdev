import { createServerFn } from "@tanstack/react-start";
import type {
  CreatePaymentLinkInput,
  PayPaymentLinkInput,
  UpdatePaymentLinkInput,
} from "@/lib/bank/payment-link-types";

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
    if (error.message === "NOT_FOUND") throw new Error("Payment link not found.");
  }
  throw error;
}

export const fetchPaymentLinkDashboard = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { getPaymentLinkDashboard } = await import("@/server/payment-link.service");
    try {
      return await getPaymentLinkDashboard(await actor(), companyId);
    } catch (error) {
      rethrowServiceError(error);
    }
  });

export const fetchPaymentLinkDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { companyId: string; linkId: string }) => input)
  .handler(async ({ data }) => {
    const { getPaymentLinkDetail } = await import("@/server/payment-link.service");
    try {
      return await getPaymentLinkDetail(await actor(), data.companyId, data.linkId);
    } catch (error) {
      rethrowServiceError(error);
    }
  });

export const createPaymentLinkRecord = createServerFn({ method: "POST" })
  .inputValidator((input: CreatePaymentLinkInput) => input)
  .handler(async ({ data }) => {
    const { createPaymentLink } = await import("@/server/payment-link.service");
    try {
      return await createPaymentLink(await actor(), data);
    } catch (error) {
      rethrowServiceError(error);
    }
  });

export const updatePaymentLinkRecord = createServerFn({ method: "POST" })
  .inputValidator((input: UpdatePaymentLinkInput) => input)
  .handler(async ({ data }) => {
    const { updatePaymentLink } = await import("@/server/payment-link.service");
    try {
      return await updatePaymentLink(await actor(), data);
    } catch (error) {
      rethrowServiceError(error);
    }
  });

export const pausePaymentLinkRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { companyId: string; linkId: string }) => input)
  .handler(async ({ data }) => {
    const { pausePaymentLink } = await import("@/server/payment-link.service");
    try {
      return await pausePaymentLink(await actor(), data.companyId, data.linkId);
    } catch (error) {
      rethrowServiceError(error);
    }
  });

export const activatePaymentLinkRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { companyId: string; linkId: string }) => input)
  .handler(async ({ data }) => {
    const { activatePaymentLink } = await import("@/server/payment-link.service");
    try {
      return await activatePaymentLink(await actor(), data.companyId, data.linkId);
    } catch (error) {
      rethrowServiceError(error);
    }
  });

export const cancelPaymentLinkRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { companyId: string; linkId: string }) => input)
  .handler(async ({ data }) => {
    const { cancelPaymentLink } = await import("@/server/payment-link.service");
    try {
      return await cancelPaymentLink(await actor(), data.companyId, data.linkId);
    } catch (error) {
      rethrowServiceError(error);
    }
  });

export const fetchPaymentLinkCheckout = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    await actor();
    const { getPaymentLinkCheckoutContext } = await import("@/server/payment-link.service");
    try {
      return await getPaymentLinkCheckoutContext(slug);
    } catch (error) {
      rethrowServiceError(error);
    }
  });

export const quotePaymentLinkCheckout = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; amount?: number }) => input)
  .handler(async ({ data }) => {
    const { quotePaymentLinkPayment } = await import("@/server/payment-link-payment.service");
    try {
      return await quotePaymentLinkPayment(await actor(), data.slug, data.amount);
    } catch (error) {
      rethrowServiceError(error);
    }
  });

export const payPaymentLinkCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: PayPaymentLinkInput) => input)
  .handler(async ({ data }) => {
    const { payPaymentLink } = await import("@/server/payment-link-payment.service");
    try {
      return await payPaymentLink(await actor(), data);
    } catch (error) {
      rethrowServiceError(error);
    }
  });

export const fetchPayFundingSourcesForCheckout = createServerFn({ method: "GET" }).handler(
  async () => {
    const user = await actor();
    const { listPayFundingSources } = await import("@/server/alta-pay.service");
    return listPayFundingSources(user);
  },
);
