import { useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import AddRounded from '@mui/icons-material/AddRounded';
import RemoveRounded from '@mui/icons-material/RemoveRounded';
import RestartAltRounded from '@mui/icons-material/RestartAltRounded';
import { EmptyState } from '@/components/common/EmptyState';
import { formatDate } from '@/utils/formatters';
import { accuracyForRow, accuracyColor, FORECAST_COLOR, ACTUAL_COLOR, type ComparisonRow } from '../comparisonData';

/** "N/A", never a number, for a cell with no real reading on that side -
 *  see `ComparisonRow`'s own doc comment (fixed 2026-09-23, real bug - "in
 *  comparioson section they are not compare the data"): the ground-truth
 *  table can genuinely have a null MaxTemp/Rainfall for a station/day, and
 *  showing that as "0°C"/"0mm" used to be indistinguishable from a real
 *  zero reading. */
function cell(value: number | null | undefined, suffix: string): string {
  return value === null || value === undefined ? 'N/A' : `${value}${suffix}`;
}

// Re-scaled 2026-09-25 ("check the size of the card, charts and data...
// unprofessional" - a deep pass, not another single-value nudge). The
// previous scale here (1rem/1.05rem cells, py: 2.5 - ~20px of padding on
// every single cell, a one-off 32px-tall Chip) was the end state of several
// separate "increase this size" requests stacked on top of each other with
// nothing to check the result against - each change looked reasonable next
// to the one before it, but the end state sat next to a *dense* KPI row
// (StatCard `dense`: 0.68rem labels) and a *compact* chart card, so the same
// page read as three unrelated densities glued together rather than one
// design. This is a standard, professional dense-data-table scale instead:
// 0.875rem body text (MUI's own `body2` size), a 0.75rem uppercase/
// letter-spaced header (the same visual language StatCard's dense label
// already uses one section up, so this table's header reads as part of the
// same system as the KPI tiles, not a different component), and a plain
// `size="small"` Chip (24px, matching every other chip on this page - the
// FilterBar's "Scoped to" chip included) instead of a custom 32px chip
// nothing else on the page matched. `EMPHASIS_CELL_SX` still bolds the
// Date/District identity columns - that contrast is what makes a dense table
// read as "designed," not the raw font size.
const HEADER_CELL_SX = {
  fontSize: '0.75rem',
  fontWeight: 700,
  whiteSpace: 'nowrap',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'text.secondary',
} as const;
const BODY_CELL_SX = { fontSize: '0.875rem', py: 1.25 } as const;
const EMPHASIS_CELL_SX = { ...BODY_CELL_SX, fontWeight: 700 } as const;
const ACCURACY_CHIP_SX = { fontWeight: 700, minWidth: 56 } as const;

// Two-row grouped header (2026-09-25 redesign) - "Forecast Max Temp"/"Actual
// Max Temp"/"Forecast Min Temp"/... as 6 flat, separately-worded columns
// repeated the words "Forecast"/"Actual"/"Temp" over and over across the
// header row, which read as noisy rather than "designed" no matter what type
// scale it used. Grouping the 3 parameters (Max Temperature/Min Temperature/
// Rainfall) as spanning headers over their own Forecast/Actual sub-columns is
// the standard reporting-table pattern for exactly this shape of data - one
// parameter, two sides. `HEADER_ROW_H` is declared once so both header rows
// share one height constant.
// <p>
// `position: sticky` (previously set per-cell here, plus `stickyHeader` on
// the Table and `borderCollapse: 'separate'`) was REMOVED 2026-09-25 (real
// bug - user's own screenshot showed only the 3 grouped param headers
// rendering, with Date/District/State, the Forecast/Actual sub-header row,
// and every body row all missing on a real single-row result). Chromium has
// a documented rendering bug where `position: sticky` combined with
// `rowSpan > 1` on table cells (exactly what Date/District/State/Accuracy
// use here) can mis-compute the sticky cell's containing block and clip or
// drop sibling content in the same row - this table is the textbook trigger
// shape for it. With this page's window capped at 1-2 rows anyway, a sticky
// header bought nothing functionally (there's rarely enough rows to scroll
// past), so dropping it entirely removes the whole bug class rather than
// trying to work around the browser quirk.
// Manual card-height control (2026-09-25, "please add increase decrease
// manually size button of the detailed comparison data card") - rather than
// this app guessing at one "correct" table height (every previous size
// change here was rejected sooner or later), the user gets direct control:
// +/- buttons step the TABLE'S OWN visible height up/down, and a reset
// button returns to the default. This sets an explicit `height` (not just a
// `maxHeight` cap), so it's a real resize the user can see immediately, in
// both directions - shrink it to be compact, or grow it to see more rows
// without the internal scrollbar.
const DEFAULT_TABLE_HEIGHT = 420;
const MIN_TABLE_HEIGHT = 200;
const MAX_TABLE_HEIGHT = 1200;
const TABLE_HEIGHT_STEP = 120;

const HEADER_ROW_H = 36;
const TOP_HEADER_SX = {
  ...HEADER_CELL_SX,
  backgroundColor: 'background.paper',
  height: HEADER_ROW_H,
} as const;
const SUB_HEADER_SX = {
  ...HEADER_CELL_SX,
  backgroundColor: 'background.paper',
  height: HEADER_ROW_H,
  fontSize: '0.7rem',
} as const;

/** Small color dot next to a Forecast/Actual sub-header label - ties the
 *  table's own column colors to the same FORECAST_COLOR/ACTUAL_COLOR the
 *  trend chart and its legend use above it, so a reader who has already
 *  learned "blue = forecast, teal = actual" from the chart doesn't have to
 *  re-learn it for the table. */
function SeriesHeaderLabel({ label, color }: { label: string; color: string }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="flex-end">
      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
      <span>{label}</span>
    </Stack>
  );
}

/** District-grain grid - one row per (district, date), covering the 3
 *  parameters Comparison shows (max/min temperature, rainfall - wind speed
 *  removed per explicit 2026-09-24 request), each shown as forecast vs
 *  actual. Accuracy is recomputed from just these 3 (see accuracyForRow's
 *  own doc comment), not the row's own 4-parameter `accuracyPct`.
 *  <p>
 *  Wrapped in the same title+subtitle Card header ChartCard.tsx uses for the
 *  trend chart above it (added 2026-09-24, "make a professional way") so the
 *  two sections of the Comparison page read as one consistent design rather
 *  than a chart card sitting above a bare table. CardContent padding
 *  (2026-09-25) now matches ChartCard's own `compact` padding exactly (p: 2)
 *  instead of MUI's roomier default - the two cards on this page now share
 *  the same outer breathing room, not two separately-tuned amounts. */
export function ComparisonGrid({ rows }: { rows: ComparisonRow[] }) {
  const [tableHeight, setTableHeight] = useState(DEFAULT_TABLE_HEIGHT);
  const atMin = tableHeight <= MIN_TABLE_HEIGHT;
  const atMax = tableHeight >= MAX_TABLE_HEIGHT;

  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Detailed Comparison
            </Typography>
            <Typography variant="caption" color="text.secondary">
              One row per district and day - forecast vs. actual, max/min temperature and rainfall
            </Typography>
          </Box>

          {rows.length > 0 && (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
              <Tooltip title="Decrease table size">
                <span>
                  <IconButton
                    size="small"
                    disabled={atMin}
                    onClick={() => setTableHeight((h) => Math.max(MIN_TABLE_HEIGHT, h - TABLE_HEIGHT_STEP))}
                  >
                    <RemoveRounded fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 44, textAlign: 'center' }}>
                {tableHeight}px
              </Typography>
              <Tooltip title="Increase table size">
                <span>
                  <IconButton
                    size="small"
                    disabled={atMax}
                    onClick={() => setTableHeight((h) => Math.min(MAX_TABLE_HEIGHT, h + TABLE_HEIGHT_STEP))}
                  >
                    <AddRounded fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Reset table size">
                <span>
                  <IconButton size="small" disabled={tableHeight === DEFAULT_TABLE_HEIGHT} onClick={() => setTableHeight(DEFAULT_TABLE_HEIGHT)}>
                    <RestartAltRounded fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          )}
        </Stack>

        {rows.length === 0 ? (
          <EmptyState message="No comparison data for the selected state/district." />
        ) : (
          // Height is now user-controlled (see the +/- buttons above) rather
          // than a single hardcoded cap this app keeps guessing at - see the
          // constants' own doc comment above. An explicit `height` (not just
          // `maxHeight`) so growing it is visible even when there are only 1
          // or 2 real rows, not just when there's enough content to need it.
          <TableContainer sx={{ height: tableHeight, transition: 'height 0.15s ease' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell rowSpan={2} sx={{ ...TOP_HEADER_SX, height: HEADER_ROW_H * 2 }}>
                    Date
                  </TableCell>
                  <TableCell rowSpan={2} sx={{ ...TOP_HEADER_SX, height: HEADER_ROW_H * 2 }}>
                    District
                  </TableCell>
                  <TableCell rowSpan={2} sx={{ ...TOP_HEADER_SX, height: HEADER_ROW_H * 2 }}>
                    State
                  </TableCell>
                  <TableCell colSpan={2} align="center" sx={TOP_HEADER_SX}>
                    Max Temperature (°C)
                  </TableCell>
                  <TableCell colSpan={2} align="center" sx={TOP_HEADER_SX}>
                    Min Temperature (°C)
                  </TableCell>
                  <TableCell colSpan={2} align="center" sx={TOP_HEADER_SX}>
                    Rainfall (mm)
                  </TableCell>
                  <TableCell rowSpan={2} align="right" sx={{ ...TOP_HEADER_SX, height: HEADER_ROW_H * 2 }}>
                    Accuracy
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell align="right" sx={SUB_HEADER_SX}>
                    <SeriesHeaderLabel label="Forecast" color={FORECAST_COLOR} />
                  </TableCell>
                  <TableCell align="right" sx={SUB_HEADER_SX}>
                    <SeriesHeaderLabel label="Actual" color={ACTUAL_COLOR} />
                  </TableCell>
                  <TableCell align="right" sx={SUB_HEADER_SX}>
                    <SeriesHeaderLabel label="Forecast" color={FORECAST_COLOR} />
                  </TableCell>
                  <TableCell align="right" sx={SUB_HEADER_SX}>
                    <SeriesHeaderLabel label="Actual" color={ACTUAL_COLOR} />
                  </TableCell>
                  <TableCell align="right" sx={SUB_HEADER_SX}>
                    <SeriesHeaderLabel label="Forecast" color={FORECAST_COLOR} />
                  </TableCell>
                  <TableCell align="right" sx={SUB_HEADER_SX}>
                    <SeriesHeaderLabel label="Actual" color={ACTUAL_COLOR} />
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow
                    key={`${r.date}-${r.district}`}
                    hover
                    // Zebra striping (2026-09-24, "make a professional way") -
                    // alternating row shading is what makes a wide, dense
                    // table like this one easy to read across without losing
                    // your place row-to-row, on top of `hover` highlighting
                    // whichever row the cursor is actually on.
                    sx={{ '&:nth-of-type(odd)': { backgroundColor: 'action.hover' } }}
                  >
                    <TableCell sx={EMPHASIS_CELL_SX}>{formatDate(r.date)}</TableCell>
                    <TableCell sx={EMPHASIS_CELL_SX}>{r.district}</TableCell>
                    <TableCell sx={BODY_CELL_SX}>{r.state}</TableCell>
                    <TableCell sx={BODY_CELL_SX} align="right">{cell(r.forecastMaxTemp, '°C')}</TableCell>
                    <TableCell sx={BODY_CELL_SX} align="right">{cell(r.actualMaxTemp, '°C')}</TableCell>
                    <TableCell sx={BODY_CELL_SX} align="right">{cell(r.forecastMinTemp, '°C')}</TableCell>
                    <TableCell sx={BODY_CELL_SX} align="right">{cell(r.actualMinTemp, '°C')}</TableCell>
                    <TableCell sx={BODY_CELL_SX} align="right">{cell(r.forecastRainfall, ' mm')}</TableCell>
                    <TableCell sx={BODY_CELL_SX} align="right">{cell(r.actualRainfall, ' mm')}</TableCell>
                    <TableCell sx={BODY_CELL_SX} align="right">
                      {(() => {
                        const acc = accuracyForRow(r);
                        return acc === null ? (
                          <Chip size="small" label="N/A" sx={ACCURACY_CHIP_SX} />
                        ) : (
                          <Chip size="small" label={`${acc}%`} color={accuracyColor(acc)} sx={ACCURACY_CHIP_SX} />
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}
