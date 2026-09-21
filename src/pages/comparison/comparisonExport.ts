import ExcelJS from 'exceljs';
import dayjs from 'dayjs';
import { buildLetterheadWorksheet, styleTableHeaderRow, styleDataRow, addFooterNote } from '@/utils/excelLetterhead';
import { downloadBlob } from '@/utils/downloadBlob';
import type { ComparisonRow } from './comparisonData';

const REPORT_TITLE = 'Forecast vs Actual';
const COLUMNS = ['Date', 'Site', 'Forecast Temp (°C)', 'Actual Temp (°C)', 'Forecast Rainfall (mm)', 'Actual Rainfall (mm)', 'Accuracy (%)'];

function toRows(rows: ComparisonRow[]): (string | number)[][] {
  return rows.map((r) => [r.date, r.siteName, r.forecastTemp, r.actualTemp, r.forecastRainfall, r.actualRainfall, r.accuracyPct]);
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
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `forecast-vs-actual-${dayjs().format('YYYY-MM-DD')}.xlsx`);
}
