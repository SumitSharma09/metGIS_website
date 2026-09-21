import type ExcelJS from 'exceljs';
import dayjs from 'dayjs';
import { BKC_LOGO_BASE64 } from '@/assets/branding/logoBase64';
import { COMPANY_NAME, COMPANY_TAGLINE, COMPANY_FOOTER_NOTE } from './branding';

const BRAND_BLUE = 'FF165CA8';
const MUTED_GREY = 'FF6E7680';
const FAINT_GREY = 'FF9AA2AC';
const HEADER_TEXT = 'FFFFFFFF';
const BORDER_GREY = 'FFB0B8C2';

export interface LetterheadResult {
  worksheet: ExcelJS.Worksheet;
  /** Row the column-header row should be written to. */
  tableHeaderRow: number;
}

/**
 * Lays out a letterhead - logo, company name/tagline, report title,
 * generated timestamp, and a divider rule - at the top of a fresh
 * worksheet, so every Excel export leaving the app looks like it came from
 * the same organization instead of a bare data dump.
 *
 * Shared by every Excel export (Tower Risk Report, Forecast vs Actual
 * comparison); a new export should call this too rather than writing its
 * own header rows.
 */
export function buildLetterheadWorksheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  reportTitle: string,
  columnCount: number
): LetterheadResult {
  const worksheet = workbook.addWorksheet(sheetName, {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });
  const lastCol = Math.max(columnCount, 4);

  const imageId = workbook.addImage({ base64: BKC_LOGO_BASE64, extension: 'png' });
  worksheet.addImage(imageId, { tl: { col: 0.15, row: 0.15 }, ext: { width: 96, height: 56 } });

  worksheet.mergeCells(1, 3, 1, lastCol);
  worksheet.getCell(1, 3).value = COMPANY_NAME;
  worksheet.getCell(1, 3).font = { bold: true, size: 16, color: { argb: BRAND_BLUE } };

  worksheet.mergeCells(2, 3, 2, lastCol);
  worksheet.getCell(2, 3).value = COMPANY_TAGLINE;
  worksheet.getCell(2, 3).font = { italic: true, size: 10, color: { argb: MUTED_GREY } };

  worksheet.mergeCells(3, 3, 3, lastCol);
  worksheet.getCell(3, 3).value = `Generated ${dayjs().format('DD MMM YYYY, HH:mm')}`;
  worksheet.getCell(3, 3).font = { size: 9, color: { argb: MUTED_GREY } };

  worksheet.mergeCells(4, 1, 4, lastCol);
  worksheet.getCell(4, 1).value = reportTitle;
  worksheet.getCell(4, 1).font = { bold: true, size: 13, color: { argb: 'FF1A1A1A' } };

  worksheet.mergeCells(5, 1, 5, lastCol);
  worksheet.getRow(5).height = 4;
  for (let c = 1; c <= lastCol; c += 1) {
    worksheet.getCell(5, c).border = { bottom: { style: 'medium', color: { argb: BRAND_BLUE } } };
  }

  worksheet.getRow(1).height = 20;
  worksheet.getRow(2).height = 16;
  worksheet.getRow(3).height = 14;
  worksheet.getRow(4).height = 22;

  return { worksheet, tableHeaderRow: 7 };
}

/** Bold, brand-blue-filled header row for the actual data table, placed a
 *  couple of rows below the letterhead block. */
export function styleTableHeaderRow(worksheet: ExcelJS.Worksheet, rowNumber: number, columnCount: number): void {
  const row = worksheet.getRow(rowNumber);
  for (let c = 1; c <= columnCount; c += 1) {
    const cell = row.getCell(c);
    cell.font = { bold: true, color: { argb: HEADER_TEXT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_BLUE } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = { bottom: { style: 'thin', color: { argb: BORDER_GREY } } };
  }
  row.height = 18;
}

/** Thin borders on every data cell, so the table reads as a table rather
 *  than loose text once the letterhead styling is stripped away by print
 *  preview / a plain viewer. */
export function styleDataRow(worksheet: ExcelJS.Worksheet, rowNumber: number, columnCount: number): void {
  const row = worksheet.getRow(rowNumber);
  for (let c = 1; c <= columnCount; c += 1) {
    row.getCell(c).border = { bottom: { style: 'hair', color: { argb: 'FFE2E5E9' } } };
  }
}

/** One-line confidentiality footer under the data table. */
export function addFooterNote(worksheet: ExcelJS.Worksheet, rowNumber: number, columnCount: number): void {
  const lastCol = Math.max(columnCount, 4);
  worksheet.mergeCells(rowNumber, 1, rowNumber, lastCol);
  const cell = worksheet.getCell(rowNumber, 1);
  cell.value = `${COMPANY_NAME} — ${COMPANY_FOOTER_NOTE}`;
  cell.font = { italic: true, size: 8, color: { argb: FAINT_GREY } };
}
