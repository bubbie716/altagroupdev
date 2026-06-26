import type { AltaCardStatementRow } from "@/lib/bank/alta-card-types";

/**
 * PDF generation placeholder for Alta Card statements.
 * Future: premium bank-style PDF with Alta branding.
 */
export async function generateStatementPdf(
  statementId: string,
): Promise<{ ok: false; message: string; statementId: string }> {
  // TODO: Implement PDF generation (e.g. @react-pdf/renderer or server-side template)
  void statementId;
  return {
    ok: false,
    message: "PDF statement generation is not yet available.",
    statementId,
  };
}

export function statementPdfDownloadLabel(statement: AltaCardStatementRow): string {
  return `Statement-${statement.statementNumber}.pdf`;
}
