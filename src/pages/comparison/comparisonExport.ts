import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';
import { buildLetterheadWorksheet, styleTableHeaderRow, styleDataRow, addFooterNote } from '@/utils/excelLetterhead';
import { drawPdfLetterhead, drawPdfFooterOnAllPages } from '@/utils/pdfLetterhead';
import { downloadBlob } from '@/utils/downloadBlob';
import { formatDate } from '@/utils/formatters';
import { accuracyForRow, type ComparisonRow } from './comparisonData';

const REPORT_TITLE = 'Forecast vs Actual (District)';
// Wind speed columns removed per explicit 2026-09-24 request ("i compare the
// max min temp and rainfall only"); Accuracy is recomputed from just these 3
// parameters via accuracyForRow, not the row's own 4-parameter accuracyPct.
const COLUMNS = [
  'Date',
  'District',
  'State',
  'Forecast Max Temp (°C)',
  'Actual Max Temp (°C)',
  'Forecast Min Temp (°C)',
  'Actual Min Temp (°C)',
  'Forecast Rainfall (mm)',
  'Actual Rainfall (mm)',
  'Accuracy (%)',
];

// "N/A", never a blank/zero cell, for a value with no real reading on that
// side - see `ComparisonRow`'s own doc comment (fixed 2026-09-23, real bug -
// "in comparioson section they are not compare the data"): the ground-truth
// table can genuinely have a null MaxTemp/Rainfall for a station/day, and an
// Excel export is exactly the kind of artifact that gets read out of context
// later, so a fabricated 0 there would be even easier to mistake for a real
// reading than it is on-screen.
function cell(value: number | null | undefined): string | number {
  return value === null || value === undefined ? 'N/A' : value;
}

function toRows(rows: ComparisonRow[]): (string | number)[][] {
  return rows.map((r) => [
    r.date,
    r.district,
    r.state,
    cell(r.forecastMaxTemp),
    cell(r.actualMaxTemp),
    cell(r.forecastMinTemp),
    cell(r.actualMinTemp),
    cell(r.forecastRainfall),
    cell(r.actualRainfall),
    cell(accuracyForRow(r)),
  ]);
}

/** Excel export with the same BKC WeatherSys letterhead used on the Tower
 *  Risk Report, so every export leaving the app is consistently branded. */
export async function exportComparisonToExcel(rows: ComparisonRow[]): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BKC WeatherSys';
  workbook.created = new Date();

  const { worksheet, tableHeaderRow } = buildLetterheadWorksheet(workbook, 'Forecast vs Actual', REPORT_TITLE, COLUMNS.length);

  worksheet.columns = COLUMNS.map(() => ({ width: 20 }));

  worksheet.getRow(tableHeaderRow).values = COLUMNS;
  styleTableHeaderRow(worksheet, tableHeaderRow, COLUMNS.length);

  toRows(rows).forEach((row, i) => {
    const rowNumber = tableHeaderRow + 1 + i;
    worksheet.getRow(rowNumber).values = row;
    styleDataRow(worksheet, rowNumber, COLUMNS.length);
  });

  addFooterNote(worksheet, tableHeaderRow + rows.length + 2, COLUMNS.length);

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `forecast-vs-actual-district-${dayjs().format('YYYY-MM-DD')}.xlsx`);
}

// PDF row values use `formatDate` (e.g. "22 Sep 2026") rather than the raw
// ISO `r.date` the Excel export keeps - added 2026-09-24 per an explicit
// "data export at pdf file" request. The Excel version is left reading the
// raw ISO date deliberately (so it stays a real sortable/filterable date
// value in a spreadsheet, not a formatted string) - see this file's own
// `toRows` above, which the PDF export does NOT reuse for that reason.
function toPdfRows(rows: ComparisonRow[]): (string | number)[][] {
  return rows.map((r) => [
    formatDate(r.date),
    r.district,
    r.state,
    cell(r.forecastMaxTemp),
    cell(r.actualMaxTemp),
    cell(r.forecastMinTemp),
    cell(r.actualMinTemp),
    cell(r.forecastRainfall),
    cell(r.actualRainfall),
    cell(accuracyForRow(r)),
  ]);
}

/** PDF export with the same BKC WeatherSys letterhead/footer treatment as
 *  every other export in this app (see exportSiteRiskToPdf in
 *  pages/reports/exportUtils.ts) - landscape, since this table has 10
 *  columns and would otherwise wrap awkwardly in portrait. */
export function exportComparisonToPdf(rows: ComparisonRow[]): void {
  const doc = new jsPDF({ orientation: 'landscape' });
  const startY = drawPdfLetterhead(doc, REPORT_TITLE);

  autoTable(doc, {
    startY,
    head: [COLUMNS],
    body: toPdfRows(rows),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [22, 92, 168] },
    margin: { left: 14, right: 14, bottom: 18 },
  });

  drawPdfFooterOnAllPages(doc);
  doc.save(`forecast-vs-actual-district-${dayjs().format('YYYY-MM-DD')}.pdf`);
}
