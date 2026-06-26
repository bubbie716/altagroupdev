import fs from "node:fs";
import { createHash } from "node:crypto";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import type { AgreementFieldData } from "@/lib/agreements/agreement-types";
import { getAgreementTemplate } from "@/lib/agreements/templates";

export type PdfTextHit = {
  pageIndex: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

async function scanTemplateTextHits(templateBytes: Uint8Array): Promise<PdfTextHit[]> {
  const doc = await pdfjs.getDocument({ data: templateBytes }).promise;
  const hits: PdfTextHit[] = [];

  for (let pageIndex = 0; pageIndex < doc.numPages; pageIndex++) {
    const page = await doc.getPage(pageIndex + 1);
    const content = await page.getTextContent();
    for (const item of content.items as Array<{ str?: string; transform: number[]; width?: number; height?: number }>) {
      const str = item.str ?? "";
      if (!str.trim()) continue;
      const tx = item.transform;
      hits.push({
        pageIndex,
        text: str,
        x: tx[4] ?? 0,
        y: tx[5] ?? 0,
        width: item.width ?? str.length * 6,
        height: item.height ?? 11,
      });
    }
  }

  return hits;
}

function findReplacementHit(hits: PdfTextHit[], search: string): PdfTextHit | null {
  const exact = hits.find((h) => h.text === search);
  if (exact) return exact;
  return hits.find((h) => h.text.includes(search)) ?? null;
}

export async function populateLoanAgreementPdf(
  templateSlug: string,
  fieldData: AgreementFieldData,
  signatureOverlay?: {
    borrowerName?: string;
    borrowerSignedAt?: string;
    bankOfficerName?: string;
    bankSignedAt?: string;
  },
): Promise<{ bytes: Uint8Array; sha256: string }> {
  const template = getAgreementTemplate(templateSlug);
  const templateBytes = fs.readFileSync(template.templatePath);
  const replacements = template.buildReplacements(fieldData);
  const hits = await scanTemplateTextHits(new Uint8Array(templateBytes));

  const pdf = await PDFDocument.load(templateBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = pdf.getPages();

  for (const [placeholder, value] of Object.entries(replacements)) {
    if (!value?.trim()) continue;
    const hit = findReplacementHit(hits, placeholder);
    if (!hit) continue;

    const page = pages[hit.pageIndex];
    if (!page) continue;

    const fontSize = Math.max(8, Math.min(hit.height, 11));
    const padding = 2;
    const coverWidth = Math.max(hit.width + 40, value.length * (fontSize * 0.55));

    page.drawRectangle({
      x: hit.x - padding,
      y: hit.y - 2,
      width: coverWidth,
      height: hit.height + 4,
      color: rgb(1, 1, 1),
      borderWidth: 0,
    });

    page.drawText(value, {
      x: hit.x,
      y: hit.y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
      maxWidth: coverWidth,
    });
  }

  // Signature page overlays (page 26 index 25)
  if (signatureOverlay && pages[25]) {
    const page = pages[25];
    const baseY = 425;
    if (signatureOverlay.borrowerName) {
      page.drawText(`Digitally signed: ${signatureOverlay.borrowerName}`, {
        x: 72,
        y: baseY - 40,
        size: 9,
        font: fontBold,
        color: rgb(0.1, 0.15, 0.35),
      });
      if (signatureOverlay.borrowerSignedAt) {
        page.drawText(`Date: ${signatureOverlay.borrowerSignedAt}`, {
          x: 72,
          y: baseY - 54,
          size: 9,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
      }
    }
    if (signatureOverlay.bankOfficerName) {
      page.drawText(`Alta Bank: ${signatureOverlay.bankOfficerName}`, {
        x: 72,
        y: 520,
        size: 9,
        font: fontBold,
        color: rgb(0.1, 0.15, 0.35),
      });
      if (signatureOverlay.bankSignedAt) {
        page.drawText(`Date: ${signatureOverlay.bankSignedAt}`, {
          x: 72,
          y: 506,
          size: 9,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
      }
    }
  }

  const bytes = await pdf.save();
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return { bytes, sha256 };
}

export async function previewLoanAgreementPdf(
  templateSlug: string,
  fieldData: AgreementFieldData,
): Promise<Uint8Array> {
  const { bytes } = await populateLoanAgreementPdf(templateSlug, fieldData);
  return bytes;
}
