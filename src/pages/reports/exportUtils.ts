import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';
import { REPORT_RISK_LABEL } from '@/utils/severity';
import { drawPdfLetterhead, drawPdfFooterOnAllPages } from '@/utils/pdfLetterhead';
import { buildLetterheadWorksheet, styleTableHeaderRow, styleDataRow, addFooterNote } from '@/utils/excelLetterhead';
import { downloadBlob } from '@/utils/downloadBlob';
import type { SiteRiskRow } from './components/SiteRiskTable';
import type { ForecastDaySnapshot } from './useSevenDayObservations';
import type { CycloneSystem } from '@/pages/hazards/hazardData';
import { CYCLONE_WARNING_LABEL } from '@/pages/hazards/hazardData';
import { RISK_COLOR, worseRisk, type RiskLevel } from '@/utils/severity';
// FORECAST_PARAMETERS lives in its own module (not in
// components/ShortLongRangeForecast.tsx) specifically so it can be
// imported here without that component importing back from this file -
// that component also calls exportShortLongRangeToPdf below, so a direct
// import in the other direction would be circular.
import { FORECAST_PARAMETERS, type Band, type ForecastCell } from './forecastParameters';
import {
  BULLETIN_SEVERITIES,
  RAIN_WIND_SEVERITY_LABEL,
  HAZARD_SEVERITY_LABEL,
  RAIN_LEGEND,
  WIND_LEGEND,
  TEMPERATURE_LEGEND,
  HAZARD_LEGEND,
  regionOf,
  type SeverityMatrix,
  type HazardEntry,
  type BulletinSeverity,
} from './bulletinData';

// Renamed on-screen from "Tower Risk Report" to "Districts Risk Report" -
// the underlying data (real per-site/per-tower observations, grouped and
// exported per district) is unchanged; only the report's displayed name and
// exported filename changed, per the 2026-09-24 request.
const REPORT_TITLE = 'Districts Risk Report';
const EXPORT_COLUMNS = ['Site', 'Code', 'State', 'District', 'Temperature (°C)', 'Rainfall (mm/hr)', 'Wind (km/h)', 'Humidity (%)', 'Lightning', 'Overall Risk'];

function toRows(rows: SiteRiskRow[]): (string | number)[][] {
  return rows.map((r) => [
    r.site.name,
    r.site.code,
    r.site.state,
    r.site.district,
    r.obs.temperature,
    r.obs.rainfallLastHour,
    r.obs.windSpeed,
    r.obs.humidity,
    r.obs.lightningStrikesLastHour,
    REPORT_RISK_LABEL[r.overallRisk],
  ]);
}

/** Excel export with a BKC WeatherSys letterhead (logo, name, tagline,
 *  generated timestamp) above the data table, so the file reads as an
 *  official company document rather than a bare spreadsheet. */
export async function exportSiteRiskToExcel(rows: SiteRiskRow[]): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BKC WeatherSys';
  workbook.created = new Date();

  const { worksheet, tableHeaderRow } = buildLetterheadWorksheet(workbook, 'Districts Risk Report', REPORT_TITLE, EXPORT_COLUMNS.length);

  worksheet.columns = EXPORT_COLUMNS.map(() => ({ width: 18 }));

  worksheet.getRow(tableHeaderRow).values = EXPORT_COLUMNS;
  styleTableHeaderRow(worksheet, tableHeaderRow, EXPORT_COLUMNS.length);

  toRows(rows).forEach((row, i) => {
    const rowNumber = tableHeaderRow + 1 + i;
    worksheet.getRow(rowNumber).values = row;
    styleDataRow(worksheet, rowNumber, EXPORT_COLUMNS.length);
  });

  addFooterNote(worksheet, tableHeaderRow + rows.length + 2, EXPORT_COLUMNS.length);

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `districts-risk-report-${dayjs().format('YYYY-MM-DD')}.xlsx`);
}

/** PDF export with the same letterhead treatment, plus a page-numbered
 *  footer on every page. */
export function exportSiteRiskToPdf(rows: SiteRiskRow[]): void {
  const doc = new jsPDF({ orientation: 'landscape' });
  const startY = drawPdfLetterhead(doc, REPORT_TITLE);

  autoTable(doc, {
    startY,
    head: [EXPORT_COLUMNS],
    body: toRows(rows),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [22, 92, 168] },
    margin: { left: 14, right: 14, bottom: 18 },
  });

  drawPdfFooterOnAllPages(doc);
  doc.save(`districts-risk-report-${dayjs().format('YYYY-MM-DD')}.pdf`);
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const value = parseInt(clean, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Draws one parameter's color-band legend (matching the on-screen swatch
 *  row above the table) directly under the letterhead, and returns the Y
 *  position the table should start at. */
function drawForecastLegend(doc: jsPDF, startY: number, legend: Band[]): number {
  const boxSize = 3;
  const leftMargin = 14;
  let x = leftMargin;
  const y = startY;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  legend.forEach((band) => {
    const [r, g, b] = hexToRgb(band.bg);
    doc.setFillColor(r, g, b);
    doc.rect(x, y - boxSize, boxSize, boxSize, 'F');
    const label = band.rangeLabel ? `${band.label} (${band.rangeLabel})` : band.label;
    doc.setTextColor(55, 65, 81);
    doc.text(label, x + boxSize + 1.5, y);
    x += boxSize + 1.5 + doc.getTextWidth(label) + 6;
  });
  return y + 6;
}

interface ShortLongRangeExportArgs {
  districts: string[];
  /** All 7 days, short-range (0-2) followed by long-range (3-6) - same
   *  order the component's `allDays` is already in. */
  days: ForecastDaySnapshot[];
  /** Every measurement/hazard parameter's pre-formatted, pre-colored cells
   *  (band + display text), keyed by parameter key then district - computed
   *  once in the component so the PDF can never disagree with the on-screen
   *  table about a value or its color. */
  cellsByParam: Record<string, Record<string, ForecastCell[]>>;
  /** The same live cyclone system the Hazards page's Cyclone Map tracks -
   *  rendered as its own page (track timeline + district warnings) rather
   *  than forced into the per-district grid above, since it's one named
   *  storm, not a baseline reading every district has. `null` until a real
   *  IMD/JTWC feed is wired in (see hazardData.ts's getActiveCyclone), in
   *  which case the page says so instead of fabricating a storm. */
  cyclone: CycloneSystem | null;
}

/**
 * Multi-page (one page per parameter, plus a Cyclone page) branded PDF of
 * the Short-Range (3-day) / Long-Range (4-day) forecast, covering every
 * parameter in FORECAST_PARAMETERS rather than just whichever tab is on
 * screen - matches the scope document's own "Short and Long-Range
 * Prediction" sample (per-district rows, per-day columns, color-banded
 * values) plus its parallel "Cyclone Forecast" sample.
 */
export function exportShortLongRangeToPdf({ districts, days, cellsByParam, cyclone }: ShortLongRangeExportArgs): void {
  const doc = new jsPDF({ orientation: 'landscape' });
  const shortDays = days.slice(0, 3);
  const longDays = days.slice(3, 7);

  const gridParams = FORECAST_PARAMETERS.filter((p) => p.kind !== 'cyclone');

  gridParams.forEach((param, index) => {
    if (index > 0) doc.addPage();

    const titleY = drawPdfLetterhead(doc, `Short-Range & Long-Range Forecast - ${param.label}`);
    const tableStartY = drawForecastLegend(doc, titleY + 3, param.legend);

    const head = [
      [
        { content: 'District', rowSpan: 2, styles: { valign: 'middle' as const } },
        {
          content: 'Short-Range Prediction (3 Days)',
          colSpan: shortDays.length,
          styles: { halign: 'center' as const, fillColor: [226, 232, 240] as [number, number, number] },
        },
        {
          content: 'Long-Range Prediction (4 Days)',
          colSpan: longDays.length,
          styles: { halign: 'center' as const, fillColor: [203, 213, 225] as [number, number, number] },
        },
      ],
      [...shortDays.map((d) => d.label), ...longDays.map((d) => d.label)],
    ];

    const body = districts.map((district) => {
      const cells = cellsByParam[param.key][district] ?? [];
      return [district, ...cells.map((c) => c.display)];
    });

    autoTable(doc, {
      startY: tableStartY,
      head,
      body,
      styles: { fontSize: 8, halign: 'center' },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
      headStyles: { fillColor: [22, 92, 168], textColor: [255, 255, 255] },
      margin: { left: 14, right: 14, bottom: 18 },
      didParseCell: (data) => {
        if (data.section !== 'body' || data.column.index === 0) return;
        const dayIndex = data.column.index - 1;
        const district = districts[data.row.index];
        const cell = cellsByParam[param.key][district]?.[dayIndex];
        if (!cell) return;
        data.cell.styles.fillColor = hexToRgb(cell.band.bg);
        data.cell.styles.textColor = hexToRgb(cell.band.text);
        data.cell.styles.fontStyle = 'bold';
      },
    });
  });

  // Cyclone page: the storm's own track timeline plus the named district
  // warnings, since it doesn't fit the per-district/per-day grid above -
  // or, while there's no real IMD/JTWC feed wired in yet, an honest "no
  // live data" note instead of a fabricated storm (see hazardData.ts's
  // getActiveCyclone doc comment).
  doc.addPage();
  if (cyclone) {
    const cycloneTitleY = drawPdfLetterhead(doc, `Cyclone Forecast - ${cyclone.name}`);
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`${cyclone.advisory} - ${cyclone.basin}`, 14, cycloneTitleY);

    autoTable(doc, {
      startY: cycloneTitleY + 4,
      head: [['Day', 'Status', 'Wind Speed', 'Classification']],
      body: cyclone.track.map((p) => [
        dayjs(p.at).format('DD MMM'),
        p.observed ? 'Observed' : 'Forecast',
        `${p.windKmph} km/h`,
        p.classification,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [22, 92, 168], textColor: [255, 255, 255] },
      margin: { left: 14, right: 14, bottom: 18 },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const warningsStartY = ((doc as any).lastAutoTable?.finalY ?? cycloneTitleY + 4) + 10;
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text('District Warnings', 14, warningsStartY);

    autoTable(doc, {
      startY: warningsStartY + 3,
      head: [['District', 'State', 'Warning Level']],
      body: cyclone.districtWarnings.map((w) => [w.district, w.state, CYCLONE_WARNING_LABEL[w.level]]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [22, 92, 168], textColor: [255, 255, 255] },
      margin: { left: 14, right: 14, bottom: 18 },
      didParseCell: (data) => {
        if (data.section !== 'body' || data.column.index !== 2) return;
        const level = cyclone.districtWarnings[data.row.index]?.level;
        if (!level) return;
        data.cell.styles.fillColor = hexToRgb(RISK_COLOR[level]);
        data.cell.styles.textColor = [255, 255, 255] as [number, number, number];
        data.cell.styles.fontStyle = 'bold';
      },
    });
  } else {
    const cycloneTitleY = drawPdfLetterhead(doc, 'Cyclone Forecast');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text('No live cyclone advisory right now - awaiting a real IMD/JTWC feed.', 14, cycloneTitleY + 6);
  }

  // Called once, after every page exists - drawPdfFooterOnAllPages redraws
  // the footer (including "Page X of Y") on every existing page each time
  // it runs, so calling it earlier in the loop above would re-stamp
  // earlier pages with a growing page count on top of their previous
  // footer text.
  drawPdfFooterOnAllPages(doc);
  doc.save(`short-long-range-forecast-${dayjs().format('YYYY-MM-DD')}.pdf`);
}

// ---- Daily Bulletin exports (National + Circle) ------------------------
// Body rows below mix plain strings with jspdf-autotable's CellDef objects
// (for rowSpan grouping and per-cell fillColor/textColor) - typed as `any`
// rather than hand-importing jspdf-autotable's own CellDef/RowInput types,
// same pragmatic tradeoff as the `(doc as any).lastAutoTable` cast already
// used above.

/** Small swatch-and-text legend row (color box + "Label: range" text,
 *  wrapping left-to-right) used above both the Rain and Wind tables -
 *  distinct from drawForecastLegend above since RAIN_LEGEND/WIND_LEGEND are
 *  plain severity->text maps, not the Short/Long-Range table's Band[]. */
function drawBulletinLegend(doc: jsPDF, startY: number, entries: { label: string; text: string; color: string }[]): number {
  const boxSize = 3;
  const leftMargin = 14;
  let x = leftMargin;
  const y = startY;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  entries.forEach((entry) => {
    const [r, g, b] = hexToRgb(entry.color);
    doc.setFillColor(r, g, b);
    doc.rect(x, y - boxSize, boxSize, boxSize, 'F');
    const label = `${entry.label}: ${entry.text}`;
    doc.setTextColor(55, 65, 81);
    doc.text(label, x + boxSize + 1.5, y);
    x += boxSize + 1.5 + doc.getTextWidth(label) + 6;
  });
  return y + 6;
}

interface NationalBulletinExportArgs {
  regions: string[];
  // Widened to a minimal `{ offset, label }[]` shape (rather than the
  // specific ForecastDaySnapshot type) since this function only ever reads
  // `.label` and the array's length/order - it never touches `.observations`
  // or `.at`, so it works unchanged whether the caller's real day data is
  // the old hourly-derived ForecastDaySnapshot[] or the Skymet-sourced
  // SkymetDaySnapshot[] (see DailyNationalBulletin.tsx's 2026-09-22
  // migration to the latter).
  days: { offset: number; label: string }[];
  rainMatrix: SeverityMatrix;
  windMatrix: SeverityMatrix;
  tempMatrix: SeverityMatrix;
  hazardRows: { key: string; label: string; cells: HazardEntry[][] }[];
  /** Maps each matrix/hazard entry's "District (State)" label back to its
   *  plain state name, so this export can decide which region a district-
   *  level entry belongs under - see DailyNationalBulletin.tsx's own
   *  stateByLabel for why this can't just call regionOf(name) directly
   *  anymore. */
  stateByLabel: Map<string, string>;
}

/**
 * Branded PDF of the Daily National Bulletin exactly as shown on screen -
 * one page each for Rain, Wind and Hazard (region-grouped rows, matching
 * the SOW's "Daily National Bulletin (Planned)" sample), plus the Hazard
 * Legend table. Takes the same pre-computed matrices/rows the screen
 * renders from, so the PDF can never disagree with what's on screen.
 */
export function exportNationalBulletinToPdf({ regions, days, rainMatrix, windMatrix, tempMatrix, hazardRows, stateByLabel }: NationalBulletinExportArgs): void {
  const doc = new jsPDF({ orientation: 'landscape' });
  const shortDays = days.slice(0, 3);
  const longDays = days.slice(3, 7);

  (
    [
      { title: 'Rain Fall Prediction', matrix: rainMatrix, legend: RAIN_LEGEND },
      { title: 'Temperature Prediction', matrix: tempMatrix, legend: TEMPERATURE_LEGEND },
      { title: 'Wind Prediction', matrix: windMatrix, legend: WIND_LEGEND },
    ] as const
  ).forEach((section, index) => {
    if (index > 0) doc.addPage();
    const titleY = drawPdfLetterhead(doc, `Daily Weather Bulletin - PAN India - ${section.title}`);
    const legendEntries = BULLETIN_SEVERITIES.map((sev) => ({
      label: RAIN_WIND_SEVERITY_LABEL[sev],
      text: section.legend[sev],
      color: RISK_COLOR[sev],
    }));
    const tableStartY = drawBulletinLegend(doc, titleY + 3, legendEntries);

    const body: any[][] = [];
    regions.forEach((region) => {
      BULLETIN_SEVERITIES.forEach((sev, sevIdx) => {
        const row: any[] = [];
        if (sevIdx === 0) {
          row.push({
            content: region,
            rowSpan: BULLETIN_SEVERITIES.length,
            styles: { valign: 'middle', fontStyle: 'bold', fillColor: [241, 245, 249] },
          });
        }
        row.push({
          content: RAIN_WIND_SEVERITY_LABEL[sev],
          styles: { fillColor: hexToRgb(RISK_COLOR[sev]), textColor: [255, 255, 255], fontStyle: 'bold' },
        });
        days.forEach((_d, i) => {
          const names = section.matrix[sev][i].filter((n) => regionOf(stateByLabel.get(n) ?? '') === region);
          row.push(names.length > 0 ? names.join(', ') : '-');
        });
        body.push(row);
      });
    });

    autoTable(doc, {
      startY: tableStartY,
      head: [
        [
          { content: 'Region', rowSpan: 2, styles: { valign: 'middle' as const } },
          { content: 'Severity', rowSpan: 2, styles: { valign: 'middle' as const } },
          {
            content: 'Short Range Prediction',
            colSpan: shortDays.length,
            styles: { halign: 'center' as const, fillColor: [226, 232, 240] as [number, number, number] },
          },
          {
            content: 'Long Range Prediction',
            colSpan: longDays.length,
            styles: { halign: 'center' as const, fillColor: [203, 213, 225] as [number, number, number] },
          },
        ],
        [...shortDays.map((d) => d.label), ...longDays.map((d) => d.label)],
      ],
      body,
      styles: { fontSize: 7.5, halign: 'center' },
      headStyles: { fillColor: [22, 92, 168], textColor: [255, 255, 255] },
      margin: { left: 14, right: 14, bottom: 18 },
    });
  });

  // Hazard Prediction page, plus its own Hazard Legend table underneath -
  // mirrors the on-screen table exactly (region rowSpan grouping, one row
  // per peril, cell text lists every affected state at its own severity).
  doc.addPage();
  const hazardTitleY = drawPdfLetterhead(doc, 'Daily Weather Bulletin - PAN India - Hazard Prediction');

  const hazardBody: any[][] = [];
  regions.forEach((region) => {
    hazardRows.forEach((row, rowIdx) => {
      const tableRow: any[] = [];
      if (rowIdx === 0) {
        tableRow.push({
          content: region,
          rowSpan: hazardRows.length,
          styles: { valign: 'middle', fontStyle: 'bold', fillColor: [241, 245, 249] },
        });
      }
      tableRow.push({ content: row.label, styles: { fontStyle: 'bold' } });
      days.forEach((_d, i) => {
        const entries = row.cells[i].filter((e) => regionOf(stateByLabel.get(e.name) ?? '') === region);
        if (entries.length === 0) {
          tableRow.push('-');
          return;
        }
        const worst = entries.reduce<RiskLevel>((acc, e) => worseRisk(acc, e.severity), 'none');
        const text = entries.map((e) => `${e.name} (${HAZARD_SEVERITY_LABEL[e.severity]})`).join(', ');
        tableRow.push({
          content: text,
          styles: { fillColor: hexToRgb(RISK_COLOR[worst]), textColor: [255, 255, 255], fontStyle: 'bold' },
        });
      });
      hazardBody.push(tableRow);
    });
  });

  autoTable(doc, {
    startY: hazardTitleY + 2,
    head: [
      [
        { content: 'Region', rowSpan: 2, styles: { valign: 'middle' as const } },
        { content: 'Peril', rowSpan: 2, styles: { valign: 'middle' as const } },
        {
          content: 'Short Range Prediction',
          colSpan: shortDays.length,
          styles: { halign: 'center' as const, fillColor: [226, 232, 240] as [number, number, number] },
        },
        {
          content: 'Long Range Prediction',
          colSpan: longDays.length,
          styles: { halign: 'center' as const, fillColor: [203, 213, 225] as [number, number, number] },
        },
      ],
      [...shortDays.map((d) => d.label), ...longDays.map((d) => d.label)],
    ],
    body: hazardBody,
    styles: { fontSize: 7, halign: 'center' },
    headStyles: { fillColor: [22, 92, 168], textColor: [255, 255, 255] },
    columnStyles: { 1: { halign: 'left' } },
    margin: { left: 14, right: 14, bottom: 18 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const legendStartY = ((doc as any).lastAutoTable?.finalY ?? hazardTitleY) + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text('Hazard Legend', 14, legendStartY);

  autoTable(doc, {
    startY: legendStartY + 3,
    head: [['Severity', ...HAZARD_LEGEND.map((l) => l.label)]],
    body: BULLETIN_SEVERITIES.map((sev) => [
      {
        content: HAZARD_SEVERITY_LABEL[sev],
        styles: { fillColor: hexToRgb(RISK_COLOR[sev]), textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const },
      },
      ...HAZARD_LEGEND.map((l) => l.bands[sev]),
    ]),
    styles: { fontSize: 7.5 },
    headStyles: { fillColor: [22, 92, 168], textColor: [255, 255, 255] },
    margin: { left: 14, right: 14, bottom: 18 },
  });

  drawPdfFooterOnAllPages(doc);
  doc.save(`daily-national-bulletin-${dayjs().format('YYYY-MM-DD')}.pdf`);
}

// ---- Daily Bulletin Excel exports (added 2026-09-24, National + Circle) --
// Same letterhead helpers as exportSiteRiskToExcel above, one worksheet per
// section (rather than one page per section like the PDF) since a workbook
// doesn't need a page break to separate them and separate sheets are more
// useful in Excel (each can be filtered/sorted independently). A short
// italic "Legend: ..." row is written into row 6 of each worksheet - the
// one row buildLetterheadWorksheet leaves blank (a bottom-border divider
// with no cell value) between the letterhead block and the table header at
// row 7 - so the legend doesn't need a rewrite of that shared helper.

function writeLegendRow(worksheet: ExcelJS.Worksheet, text: string, columnCount: number): void {
  const lastCol = Math.max(columnCount, 4);
  worksheet.mergeCells(6, 1, 6, lastCol);
  const cell = worksheet.getCell(6, 1);
  cell.value = text;
  cell.font = { italic: true, size: 8.5, color: { argb: 'FF6E7680' } };
}

function bulletinLegendText(legend: Record<BulletinSeverity, string>): string {
  return `Legend:  ${BULLETIN_SEVERITIES.map((sev) => `${RAIN_WIND_SEVERITY_LABEL[sev]}: ${legend[sev]}`).join('   |   ')}`;
}

/** One worksheet: letterhead, an optional legend row, a header row, then
 *  one plain data row per array entry (no rowSpan grouping like the PDF -
 *  a repeated first-column value per row is more useful in a spreadsheet,
 *  since it keeps every row independently sortable/filterable). */
function writeBulletinSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  reportTitle: string,
  columns: string[],
  rows: (string | number)[][],
  legendText?: string
): void {
  const { worksheet, tableHeaderRow } = buildLetterheadWorksheet(workbook, sheetName, reportTitle, columns.length);
  worksheet.columns = columns.map((_c, i) => ({ width: i < 2 ? 22 : 16 }));
  if (legendText) writeLegendRow(worksheet, legendText, columns.length);

  worksheet.getRow(tableHeaderRow).values = columns;
  styleTableHeaderRow(worksheet, tableHeaderRow, columns.length);

  rows.forEach((row, i) => {
    const rowNumber = tableHeaderRow + 1 + i;
    worksheet.getRow(rowNumber).values = row;
    styleDataRow(worksheet, rowNumber, columns.length);
  });

  addFooterNote(worksheet, tableHeaderRow + rows.length + 2, columns.length);
}

/** A lead "Summary" worksheet carrying the Circle Bulletin's auto-generated
 *  headline callout (see bulletinData.ts's buildSkymetCircleHeadlines) -
 *  narrative text doesn't fit the header/row shape every other sheet uses,
 *  so it gets its own sheet instead of being crammed into a legend row. */
function writeHeadlinesSheet(workbook: ExcelJS.Workbook, reportTitle: string, headlines: string[]): void {
  const { worksheet, tableHeaderRow } = buildLetterheadWorksheet(workbook, 'Summary', reportTitle, 4);
  headlines.forEach((line, i) => {
    const rowNumber = tableHeaderRow + i;
    worksheet.mergeCells(rowNumber, 1, rowNumber, 4);
    const cell = worksheet.getCell(rowNumber, 1);
    cell.value = `• ${line}`;
    cell.font = { size: 10 };
    worksheet.getRow(rowNumber).height = 18;
  });
}

/**
 * Excel counterpart to exportNationalBulletinToPdf above - same source data
 * (so it can never disagree with what's on screen or in the PDF), laid out
 * as: one sheet each for Rain/Temperature/Wind (Region, Severity, day
 * columns), one Hazard sheet (Region, Peril, day columns), and one Hazard
 * Legend sheet.
 */
export async function exportNationalBulletinToExcel({
  regions,
  days,
  rainMatrix,
  windMatrix,
  tempMatrix,
  hazardRows,
  stateByLabel,
}: NationalBulletinExportArgs): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BKC WeatherSys';
  workbook.created = new Date();

  const dayColumns = days.map((d) => d.label);

  (
    [
      { title: 'Rain Fall Prediction', sheet: 'Rain Fall Prediction', matrix: rainMatrix, legend: RAIN_LEGEND },
      { title: 'Temperature Prediction', sheet: 'Temperature Prediction', matrix: tempMatrix, legend: TEMPERATURE_LEGEND },
      { title: 'Wind Prediction', sheet: 'Wind Prediction', matrix: windMatrix, legend: WIND_LEGEND },
    ] as const
  ).forEach((section) => {
    const rows: (string | number)[][] = [];
    regions.forEach((region) => {
      BULLETIN_SEVERITIES.forEach((sev) => {
        const values = dayColumns.map((_label, i) => {
          const names = section.matrix[sev][i].filter((n) => regionOf(stateByLabel.get(n) ?? '') === region);
          return names.length > 0 ? names.join(', ') : '-';
        });
        rows.push([region, RAIN_WIND_SEVERITY_LABEL[sev], ...values]);
      });
    });
    writeBulletinSheet(
      workbook,
      section.sheet,
      `Daily Weather Bulletin - PAN India - ${section.title}`,
      ['Region', 'Severity', ...dayColumns],
      rows,
      bulletinLegendText(section.legend)
    );
  });

  const hazardBodyRows: (string | number)[][] = [];
  regions.forEach((region) => {
    hazardRows.forEach((row) => {
      const values = dayColumns.map((_label, i) => {
        const entries = row.cells[i].filter((e) => regionOf(stateByLabel.get(e.name) ?? '') === region);
        if (entries.length === 0) return '-';
        return entries.map((e) => `${e.name} (${HAZARD_SEVERITY_LABEL[e.severity]})`).join(', ');
      });
      hazardBodyRows.push([region, row.label, ...values]);
    });
  });
  writeBulletinSheet(
    workbook,
    'Hazard',
    'Daily Weather Bulletin - PAN India - Hazard Prediction',
    ['Region', 'Peril', ...dayColumns],
    hazardBodyRows
  );

  const hazardLegendColumns = ['Severity', ...HAZARD_LEGEND.map((l) => l.label)];
  const hazardLegendRows = BULLETIN_SEVERITIES.map((sev) => [
    HAZARD_SEVERITY_LABEL[sev],
    ...HAZARD_LEGEND.map((l) => l.bands[sev]),
  ]);
  writeBulletinSheet(workbook, 'Hazard Legend', 'Daily Weather Bulletin - Hazard Legend', hazardLegendColumns, hazardLegendRows);

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `daily-national-bulletin-${dayjs().format('YYYY-MM-DD')}.xlsx`
  );
}

interface CircleBulletinExportArgs {
  circle: string;
  // Same widened shape as NationalBulletinExportArgs.days above, for the
  // same reason - see that field's own comment.
  days: { offset: number; label: string }[];
  rainMatrix: SeverityMatrix;
  windMatrix: SeverityMatrix;
  tempMatrix: SeverityMatrix;
  hazardRows: { key: string; label: string; cells: HazardEntry[][] }[];
  headlines: string[];
}

/**
 * Branded PDF of the Daily Circle Bulletin - the callout headline box,
 * then district-view Rain/Wind tables (flat, no region grouping - already
 * scoped to one circle) and a Hazard table. Unlike the on-screen HazardBlock
 * (a plain colored box revealed only on hover, since screen space is tight),
 * the PDF has no hover affordance, so hazard cells spell out the affected
 * district(s) and severity as text instead of relying on a tooltip.
 */
export function exportCircleBulletinToPdf({ circle, days, rainMatrix, windMatrix, tempMatrix, hazardRows, headlines }: CircleBulletinExportArgs): void {
  const doc = new jsPDF({ orientation: 'landscape' });
  const shortDays = days.slice(0, 3);
  const longDays = days.slice(3, 7);
  const pageWidth = doc.internal.pageSize.getWidth();

  let cursorY = drawPdfLetterhead(doc, `Daily Weather Bulletin - ${circle} - ${dayjs().format('D MMM YYYY')}`);

  if (headlines.length > 0) {
    const boxHeight = 6 + headlines.length * 5;
    doc.setFillColor(58, 20, 64); // matches the on-screen callout box (#3a1440)
    doc.roundedRect(14, cursorY, pageWidth - 28, boxHeight, 1, 1, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    headlines.forEach((line, i) => doc.text(`* ${line}`, 18, cursorY + 6 + i * 5));
    cursorY += boxHeight + 8;
  }

  (
    [
      { title: 'Rain Fall Prediction - District view', matrix: rainMatrix, legend: RAIN_LEGEND },
      { title: 'Temperature Prediction - District view', matrix: tempMatrix, legend: TEMPERATURE_LEGEND },
      { title: 'Wind Prediction - District view', matrix: windMatrix, legend: WIND_LEGEND },
    ] as const
  ).forEach((section, index) => {
    let sectionY = cursorY;
    if (index > 0) {
      doc.addPage();
      sectionY = drawPdfLetterhead(doc, `Daily Weather Bulletin - ${circle} - ${section.title}`);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      doc.text(section.title, 14, sectionY);
      sectionY += 5;
    }

    const legendEntries = BULLETIN_SEVERITIES.map((sev) => ({
      label: RAIN_WIND_SEVERITY_LABEL[sev],
      text: section.legend[sev],
      color: RISK_COLOR[sev],
    }));
    const tableStartY = drawBulletinLegend(doc, sectionY + 3, legendEntries);

    const body: any[][] = BULLETIN_SEVERITIES.map((sev) => {
      const row: any[] = [
        {
          content: RAIN_WIND_SEVERITY_LABEL[sev],
          styles: { fillColor: hexToRgb(RISK_COLOR[sev]), textColor: [255, 255, 255], fontStyle: 'bold' },
        },
      ];
      days.forEach((_d, i) => {
        row.push(section.matrix[sev][i].length > 0 ? section.matrix[sev][i].join(', ') : '-');
      });
      return row;
    });

    autoTable(doc, {
      startY: tableStartY,
      head: [
        [
          { content: 'Severity', rowSpan: 2, styles: { valign: 'middle' as const } },
          {
            content: 'Short Range Prediction',
            colSpan: shortDays.length,
            styles: { halign: 'center' as const, fillColor: [226, 232, 240] as [number, number, number] },
          },
          {
            content: 'Long Range Prediction',
            colSpan: longDays.length,
            styles: { halign: 'center' as const, fillColor: [203, 213, 225] as [number, number, number] },
          },
        ],
        [...shortDays.map((d) => d.label), ...longDays.map((d) => d.label)],
      ],
      body,
      styles: { fontSize: 8, halign: 'center' },
      headStyles: { fillColor: [22, 92, 168], textColor: [255, 255, 255] },
      margin: { left: 14, right: 14, bottom: 18 },
    });
  });

  doc.addPage();
  const hazardTitleY = drawPdfLetterhead(doc, `Daily Weather Bulletin - ${circle} - Hazard Prediction`);

  const hazardBody: any[][] = hazardRows.map((row) => {
    const cells: any[] = [{ content: row.label, styles: { fontStyle: 'bold' } }];
    row.cells.forEach((entries) => {
      if (entries.length === 0) {
        cells.push('-');
        return;
      }
      const worst = entries.reduce<RiskLevel>((acc, e) => worseRisk(acc, e.severity), 'none');
      const text = entries.map((e) => `${e.name} (${HAZARD_SEVERITY_LABEL[e.severity]})`).join(', ');
      cells.push({
        content: text,
        styles: { fillColor: hexToRgb(RISK_COLOR[worst]), textColor: [255, 255, 255], fontStyle: 'bold' },
      });
    });
    return cells;
  });

  autoTable(doc, {
    startY: hazardTitleY + 2,
    head: [
      [
        { content: 'Peril', rowSpan: 2, styles: { valign: 'middle' as const } },
        {
          content: 'Short Range Prediction',
          colSpan: shortDays.length,
          styles: { halign: 'center' as const, fillColor: [226, 232, 240] as [number, number, number] },
        },
        {
          content: 'Long Range Prediction',
          colSpan: longDays.length,
          styles: { halign: 'center' as const, fillColor: [203, 213, 225] as [number, number, number] },
        },
      ],
      [...shortDays.map((d) => d.label), ...longDays.map((d) => d.label)],
    ],
    body: hazardBody,
    styles: { fontSize: 7.5 },
    headStyles: { fillColor: [22, 92, 168], textColor: [255, 255, 255] },
    columnStyles: { 0: { halign: 'left' } },
    margin: { left: 14, right: 14, bottom: 18 },
  });

  drawPdfFooterOnAllPages(doc);
  const slug = circle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  doc.save(`daily-circle-bulletin-${slug}-${dayjs().format('YYYY-MM-DD')}.pdf`);
}

/**
 * Excel counterpart to exportCircleBulletinToPdf above - same source data,
 * laid out as: a Summary sheet with the auto-generated headlines (if any),
 * one sheet each for Rain/Temperature/Wind (Severity + day columns, already
 * scoped to one circle so no Region/District grouping column is needed -
 * matches the on-screen "District view" tables, which are flat for the same
 * reason), and one Hazard sheet.
 */
export async function exportCircleBulletinToExcel({
  circle,
  days,
  rainMatrix,
  windMatrix,
  tempMatrix,
  hazardRows,
  headlines,
}: CircleBulletinExportArgs): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BKC WeatherSys';
  workbook.created = new Date();

  const dayColumns = days.map((d) => d.label);
  const bulletinTitle = `Daily Weather Bulletin - ${circle} - ${dayjs().format('D MMM YYYY')}`;

  if (headlines.length > 0) {
    writeHeadlinesSheet(workbook, bulletinTitle, headlines);
  }

  (
    [
      { title: 'Rain Fall Prediction - District view', sheet: 'Rain Fall', matrix: rainMatrix, legend: RAIN_LEGEND },
      { title: 'Temperature Prediction - District view', sheet: 'Temperature', matrix: tempMatrix, legend: TEMPERATURE_LEGEND },
      { title: 'Wind Prediction - District view', sheet: 'Wind', matrix: windMatrix, legend: WIND_LEGEND },
    ] as const
  ).forEach((section) => {
    const rows: (string | number)[][] = BULLETIN_SEVERITIES.map((sev) => [
      RAIN_WIND_SEVERITY_LABEL[sev],
      ...dayColumns.map((_label, i) => (section.matrix[sev][i].length > 0 ? section.matrix[sev][i].join(', ') : '-')),
    ]);
    writeBulletinSheet(
      workbook,
      section.sheet,
      `Daily Weather Bulletin - ${circle} - ${section.title}`,
      ['Severity', ...dayColumns],
      rows,
      bulletinLegendText(section.legend)
    );
  });

  const hazardBodyRows: (string | number)[][] = hazardRows.map((row) => [
    row.label,
    ...dayColumns.map((_label, i) => {
      const entries = row.cells[i];
      if (entries.length === 0) return '-';
      return entries.map((e) => `${e.name} (${HAZARD_SEVERITY_LABEL[e.severity]})`).join(', ');
    }),
  ]);
  writeBulletinSheet(
    workbook,
    'Hazard',
    `Daily Weather Bulletin - ${circle} - Hazard Prediction`,
    ['Peril', ...dayColumns],
    hazardBodyRows
  );

  const buffer = await workbook.xlsx.writeBuffer();
  const slug = circle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `daily-circle-bulletin-${slug}-${dayjs().format('YYYY-MM-DD')}.xlsx`
  );
}
