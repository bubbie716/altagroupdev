import { createServerFn } from "@tanstack/react-start";
import type {
  CreatePayrollEmployeeInput,
  CreatePayrollRunInput,
  CreateScheduledPaymentInput,
  UpdatePayrollEmployeeInput,
} from "@/lib/bank/business-banking-types";

async function actor() {
  const { requireAuth } = await import("@/server/auth.service");
  return requireAuth();
}

export const fetchBusinessBankingOverview = createServerFn({ method: "GET" })
  .inputValidator((companyId: string | undefined) => companyId)
  .handler(async ({ data: companyId }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabBusinessBankingOverview } = await import(
        "@/lib/bank/ui-lab-commercial-fixtures"
      );
      return getUiLabBusinessBankingOverview(companyId);
    }
    const { getBusinessBankingOverview } = await import("@/server/business-banking.service");
    const user = await actor();
    return getBusinessBankingOverview(user, companyId);
  });

export const fetchScheduledPayments = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabScheduledPayments } = await import("@/lib/bank/ui-lab-commercial-fixtures");
      return getUiLabScheduledPayments(companyId);
    }
    const { listScheduledPayments } = await import("@/server/business-banking.service");
    const user = await actor();
    return listScheduledPayments(user, companyId);
  });

export const createScheduledPaymentRecord = createServerFn({ method: "POST" })
  .inputValidator((input: CreateScheduledPaymentInput) => input)
  .handler(async ({ data }) => {
    const { createScheduledPayment } = await import("@/server/business-banking.service");
    const user = await actor();
    return createScheduledPayment(user, data);
  });

export const cancelScheduledPaymentRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { companyId: string; paymentId: string }) => input)
  .handler(async ({ data }) => {
    const { cancelScheduledPayment } = await import("@/server/business-banking.service");
    const user = await actor();
    return cancelScheduledPayment(user, data.companyId, data.paymentId);
  });

export const fetchPayrollEmployees = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabPayrollEmployees } = await import("@/lib/bank/ui-lab-commercial-fixtures");
      return getUiLabPayrollEmployees(companyId);
    }
    const { listPayrollEmployees } = await import("@/server/business-banking.service");
    const user = await actor();
    return listPayrollEmployees(user, companyId);
  });

export const createPayrollEmployeeRecord = createServerFn({ method: "POST" })
  .inputValidator((input: CreatePayrollEmployeeInput) => input)
  .handler(async ({ data }) => {
    const { createPayrollEmployee } = await import("@/server/business-banking.service");
    const user = await actor();
    return createPayrollEmployee(user, data);
  });

export const updatePayrollEmployeeRecord = createServerFn({ method: "POST" })
  .inputValidator((input: UpdatePayrollEmployeeInput) => input)
  .handler(async ({ data }) => {
    const { updatePayrollEmployee } = await import("@/server/business-banking.service");
    const user = await actor();
    return updatePayrollEmployee(user, data);
  });

export const deactivatePayrollEmployeeRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { companyId: string; employeeId: string }) => input)
  .handler(async ({ data }) => {
    const { deactivatePayrollEmployee } = await import("@/server/business-banking.service");
    const user = await actor();
    return deactivatePayrollEmployee(user, data.companyId, data.employeeId);
  });

export const fetchPayrollRuns = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabPayrollRuns } = await import("@/lib/bank/ui-lab-commercial-fixtures");
      return getUiLabPayrollRuns(companyId);
    }
    const { listPayrollRuns } = await import("@/server/business-banking.service");
    const user = await actor();
    return listPayrollRuns(user, companyId);
  });

export const createPayrollRunRecord = createServerFn({ method: "POST" })
  .inputValidator((input: CreatePayrollRunInput) => input)
  .handler(async ({ data }) => {
    const { createPayrollRun } = await import("@/server/business-banking.service");
    const user = await actor();
    return createPayrollRun(user, data);
  });

export const fetchBusinessRepresentatives = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabRepresentatives } = await import("@/lib/bank/ui-lab-commercial-fixtures");
      return getUiLabRepresentatives(companyId);
    }
    const { listBusinessRepresentatives } = await import("@/server/business-banking.service");
    const user = await actor();
    return listBusinessRepresentatives(user, companyId);
  });
