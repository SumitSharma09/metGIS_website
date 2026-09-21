import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import { useListCirclesQuery, useListSitesQuery } from '@/features/sites/sitesApi';
import { RISK_COLOR, worseRisk, type RiskLevel } from '@/utils/severity';
import { getActiveCyclone } from '@/pages/hazards/hazardData';
import { EmptyState } from '@/components/common/EmptyState';
import { useSevenDayObservations } from '../useSevenDayObservations';
import { useSevenDayForecastTotals } from '../useSevenDayForecastTotals';
import { exportCircleBulletinToPdf } from '../exportUtils';
import {
  BULLETIN_SEVERITIES,
  RAIN_WIND_SEVERITY_LABEL,
  RAIN_LEGEND,
  WIND_LEGEND,
  TEMPERATURE_LEGEND,
  BULLETIN_HAZARD_PERILS,
  buildParameterMatrix,
  buildForecastParameterMatrix,
  buildHazardRow,
  buildCycloneHazardRow,
  buildCircleHeadlines,
  type HazardEntry,
} from '../bulletinData';

const BANNER_BG = '#8e2a8e';
const PANEL_BG = '#f6e6f6';
const PANEL_BORDER = '#c9a0c9';
const CALLOUT_BG = '#3a1440';
// Same fixed "printed document" panel as the National Bulletin - see that
// file's comment. Text placed directly on PANEL_BG (the severity-scale
// captions, and the hazard-block caption below the table) needs its own
// pinned dark color instead of the theme's text color, which turns light in
// dark mode and becomes unreadable against this permanently pale-pink panel.
const PANEL_TEXT = CALLOUT_BG;

function SeverityCell({ label, severity }: { label: string; severity: 'warning' | 'alert' | 'watch' }) {
  return (
    <TableCell sx={{ backgroundColor: RISK_COLOR[severity], color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {label}
    </TableCell>
  );
}

/** The SOW's circle-view Hazard table shows one plain colored block per
 *  day (no per-district text - it's already scoped to a single circle,
 *  so there's nothing left to label within a cell) - the worst severity
 *  among the circle's districts that day decides the color, and a tooltip
 *  keeps the per-district detail available without cluttering the cell. */
function HazardBlock({ entries }: { entries: HazardEntry[] }) {
  if (entries.length === 0) {
    return <Box sx={{ height: 22, borderRadius: 0.5, backgroundColor: 'action.hover' }} />;
  }
  const worst = entries.reduce<RiskLevel>((acc, e) => worseRisk(acc, e.severity), 'none');
  const tooltip = entries.map((e) => `${e.name}: ${e.severity}`).join(', ');
  return (
    <Tooltip title={tooltip} arrow>
      <Box sx={{ height: 22, borderRadius: 0.5, backgroundColor: RISK_COLOR[worst] }} />
    </Tooltip>
  );
}

/**
 * The SOW document's "Daily Circle level bulletin (Planned)" sample: one
 * circle at a time, district-view Rain/Wind tables (same severity-rows x
 * day-columns shape as the National Bulletin, just grouped by district
 * instead of region-then-state), a Hazard table of plain colored blocks,
 * and a two-line auto-generated headline callout. See bulletinData.ts for
 * how the matrices and headlines are built.
 */
// Same fix as DailyNationalBulletin.tsx (and LiveMapPage.tsx before it) -
// pageSize: 500 was a leftover from the old demo dataset. A single real
// circle can have 5,000-19,000+ towers, and only a small scattered subset
// of any circle's towers actually has real hourly_weather data, so a
// 500-site slice almost never included one of them. No upper cap on the
// backend, so this just means "every site in the selected circle."
const SITE_PAGE_SIZE = 100000;

export function DailyCircleBulletin() {
  const { data: circles = [] } = useListCirclesQuery();
  const [circle, setCircle] = useState<string | null>(null);

  const { data: sitesPage, isLoading: sitesLoading } = useListSitesQuery(
    { circle: circle ?? undefined, pageSize: SITE_PAGE_SIZE },
    { skip: !circle }
  );
  const sites = useMemo(() => sitesPage?.items ?? [], [sitesPage]);
  const siteIds = useMemo(() => sites.map((s) => s.id), [sites]);
  const { days, isLoading: obsLoading } = useSevenDayObservations(siteIds);
  const { days: forecastDays, isLoading: forecastLoading } = useSevenDayForecastTotals(siteIds);
  const cyclone = useMemo(() => getActiveCyclone(), []);

  const districts = useMemo(() => new Set(sites.map((s) => s.district)), [sites]);

  // Same real daily-aggregated source as the National Bulletin - see that
  // file's comment.
  const rainMatrix = useMemo(
    () => buildForecastParameterMatrix(sites, forecastDays, 'rainfall', (s) => s.district),
    [sites, forecastDays]
  );
  const tempMatrix = useMemo(
    () => buildForecastParameterMatrix(sites, forecastDays, 'temperature', (s) => s.district),
    [sites, forecastDays]
  );
  const windMatrix = useMemo(() => buildParameterMatrix(sites, days, 'windSpeed', (s) => s.district), [sites, days]);

  const hazardRows = useMemo(
    () => [
      {
        key: 'cyclone',
        label: cyclone ? `Cyclone (${cyclone.name})` : 'Cyclone (no live data)',
        cells: buildCycloneHazardRow(cyclone, days, (district) => (districts.has(district) ? district : null)),
      },
      ...BULLETIN_HAZARD_PERILS.map((peril) => ({
        key: peril.key,
        label: peril.label,
        cells: buildHazardRow(sites, days, peril, (s) => s.district),
      })),
    ],
    [sites, days, cyclone, districts]
  );

  const headlines = useMemo(
    () => (circle ? buildCircleHeadlines(circle, sites, days) : []),
    [circle, sites, days]
  );

  const shortDays = days.slice(0, 3);
  const longDays = days.slice(3, 7);

  const loading = sitesLoading || obsLoading || forecastLoading;

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Autocomplete
          options={circles}
          value={circle}
          onChange={(_e, value) => setCircle(value)}
          sx={{ maxWidth: 320, flexGrow: 1 }}
          renderInput={(params) => <TextField {...params} label="Circle" size="small" />}
        />
        <Button
          size="small"
          variant="outlined"
          startIcon={<PictureAsPdfRoundedIcon />}
          disabled={!circle || loading || sites.length === 0}
          onClick={() =>
            circle &&
            exportCircleBulletinToPdf({ circle, days, rainMatrix, windMatrix, tempMatrix, hazardRows, headlines })
          }
        >
          Export PDF
        </Button>
      </Stack>

      {!circle ? (
        <EmptyState message="Select a circle to view its daily bulletin." />
      ) : loading ? (
        <Typography variant="body2" color="text.secondary">
          Loading bulletin...
        </Typography>
      ) : sites.length === 0 ? (
        <EmptyState message="No sites found for this circle." />
      ) : (
        <Paper variant="outlined" sx={{ overflow: 'hidden', border: `1px solid ${PANEL_BORDER}` }}>
          <Box sx={{ backgroundColor: BANNER_BG, color: '#fff', textAlign: 'center', py: 1 }}>
            <Typography variant="h6" fontWeight={800}>
              Daily Weather Bulletin - {circle} - {dayjs().format('D MMM YYYY')}
            </Typography>
          </Box>

          <Box sx={{ backgroundColor: PANEL_BG, p: 2 }}>
            <Stack spacing={3}>
              <Box sx={{ backgroundColor: CALLOUT_BG, color: '#fff', borderRadius: 1, p: 1.5 }}>
                {headlines.map((line) => (
                  <Typography key={line} variant="body2" sx={{ '&::before': { content: '"* "' } }}>
                    {line}
                  </Typography>
                ))}
              </Box>

              {(
                [
                  { title: 'Rain Fall Prediction - District view', matrix: rainMatrix, legend: RAIN_LEGEND },
                  { title: 'Temperature Prediction - District view', matrix: tempMatrix, legend: TEMPERATURE_LEGEND },
                  { title: 'Wind Prediction - District view', matrix: windMatrix, legend: WIND_LEGEND },
                ] as const
              ).map((section) => (
                <Box key={section.title}>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ '& th': { backgroundColor: BANNER_BG, color: '#fff', fontWeight: 700 } }}>
                          <TableCell align="center">{section.title}</TableCell>
                          <TableCell colSpan={shortDays.length} align="center">
                            Short Range Prediction
                          </TableCell>
                          <TableCell colSpan={longDays.length} align="center">
                            Long Range Prediction
                          </TableCell>
                        </TableRow>
                        <TableRow sx={{ '& th': { backgroundColor: 'action.hover', fontWeight: 700 } }}>
                          <TableCell>Severity</TableCell>
                          {days.map((d) => (
                            <TableCell key={d.offset} align="center">
                              {d.label}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {BULLETIN_SEVERITIES.map((sev) => (
                          <TableRow key={sev}>
                            <SeverityCell label={RAIN_WIND_SEVERITY_LABEL[sev]} severity={sev} />
                            {days.map((d, i) => (
                              <TableCell key={d.offset} align="center" sx={{ fontSize: 11.5 }}>
                                {section.matrix[sev][i].length > 0 ? section.matrix[sev][i].join(', ') : '—'}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap sx={{ mt: 1, px: 0.5 }}>
                    {BULLETIN_SEVERITIES.map((sev) => (
                      <Typography key={sev} variant="caption" sx={{ color: PANEL_TEXT }}>
                        <b>{RAIN_WIND_SEVERITY_LABEL[sev]}:</b> {section.legend[sev]}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              ))}

              <Box>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { backgroundColor: BANNER_BG, color: '#fff', fontWeight: 700 } }}>
                        <TableCell align="center">Hazard Prediction - District view</TableCell>
                        <TableCell colSpan={shortDays.length} align="center">
                          Short Range Prediction
                        </TableCell>
                        <TableCell colSpan={longDays.length} align="center">
                          Long Range Prediction
                        </TableCell>
                      </TableRow>
                      <TableRow sx={{ '& th': { backgroundColor: 'action.hover', fontWeight: 700 } }}>
                        <TableCell>Peril</TableCell>
                        {days.map((d) => (
                          <TableCell key={d.offset} align="center">
                            {d.label}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {hazardRows.map((row) => (
                        <TableRow key={row.key}>
                          <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{row.label}</TableCell>
                          {days.map((d, i) => (
                            <TableCell key={d.offset} sx={{ p: 0.5, minWidth: 70 }}>
                              <HazardBlock entries={row.cells[i]} />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Typography variant="caption" sx={{ display: 'block', mt: 1, px: 0.5, color: PANEL_TEXT }}>
                  Hover a colored block for the affected district(s) and severity - green/blank = normal, yellow =
                  moderate, orange = high, red = extreme.
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Paper>
      )}
    </Stack>
  );
}
