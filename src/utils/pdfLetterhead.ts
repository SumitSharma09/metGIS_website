import type { jsPDF } from 'jspdf';
import dayjs from 'dayjs';
import { BKC_LOGO_BASE64, BKC_LOGO_WIDTH, BKC_LOGO_HEIGHT } from '@/assets/branding/logoBase64';
import { COMPANY_NAME, COMPANY_TAGLINE, COMPANY_FOOTER_NOTE } from './branding';

const LOGO_DRAW_HEIGHT = 14; // mm
const LOGO_DRAW_WIDTH = (BKC_LOGO_WIDTH / BKC_LOGO_HEIGHT) * LOGO_DRAW_HEIGHT;
const MARGIN_X = 14;
const BRAND_BLUE: [number, number, number] = [22, 92, 168];
const MUTED_GREY: [number, number, number] = [110, 118, 128];

/**
 * Draws a letterhead (logo, company name/tagline, report title, generated
 * timestamp, and a divider rule) at the top of the current page, and
 * returns the Y coordinate content should start below.
 *
 * Shared by every PDF export (Tower Risk Reports today; any future export
 * should call this too, rather than hand-rolling its own header) so every
 * document leaving the app looks like it came from the same organization.
 */
export function drawPdfLetterhead(doc: jsPDF, reportTitle: string): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.addImage(BKC_LOGO_BASE64, 'PNG', MARGIN_X, 10, LOGO_DRAW_WIDTH, LOGO_DRAW_HEIGHT);

  const textX = MARGIN_X + LOGO_DRAW_WIDTH + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...BRAND_BLUE);
  doc.text(COMPANY_NAME, textX, 15.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED_GREY);
  doc.text(COMPANY_TAGLINE, textX, 20.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED_GREY);
  const generatedLabel = `Generated ${dayjs().format('DD MMM YYYY, HH:mm')}`;
  doc.text(generatedLabel, pageWidth - MARGIN_X, 13, { align: 'right' });

  doc.setDrawColor(...BRAND_BLUE);
  doc.setLineWidth(0.6);
  doc.line(MARGIN_X, 26, pageWidth - MARGIN_X, 26);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text(reportTitle, MARGIN_X, 34);

  return 40; // content startY
}

/** Stamps a footer (confidentiality note + page N of M) on every page
 *  already drawn. Call once, after the document's content is finished. */
export function drawPdfFooterOnAllPages(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(...MUTED_GREY);
    doc.setLineWidth(0.2);
    doc.line(MARGIN_X, pageHeight - 14, pageWidth - MARGIN_X, pageHeight - 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED_GREY);
    doc.text(`${COMPANY_NAME} — ${COMPANY_FOOTER_NOTE}`, MARGIN_X, pageHeight - 9);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - MARGIN_X, pageHeight - 9, { align: 'right' });
  }
}
