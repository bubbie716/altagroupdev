import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

const PDF_EXPORT_CLASS = "statement-document--pdf-export";
const MARGIN_MM = 14;

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-");
}

/** Capture a DOM node and save it as a multi-page letter-size PDF. */
export async function downloadElementAsPdf(element: HTMLElement, filename: string): Promise<void> {
  element.classList.add(PDF_EXPORT_CLASS);

  try {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - MARGIN_MM * 2;
    const contentHeight = pageHeight - MARGIN_MM * 2;
    const imgHeight = (canvas.height * contentWidth) / canvas.width;
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const totalPages = Math.max(1, Math.ceil(imgHeight / contentHeight));

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage();
      const y = MARGIN_MM - page * contentHeight;
      pdf.addImage(imgData, "JPEG", MARGIN_MM, y, contentWidth, imgHeight);
    }

    pdf.save(sanitizeFilename(filename));
  } finally {
    element.classList.remove(PDF_EXPORT_CLASS);
  }
}
