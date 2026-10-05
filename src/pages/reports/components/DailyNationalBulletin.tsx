import { useMemo } from 'react';
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
import Button from '@mui/material/Button';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded';
import { useListSitesQuery } from '@/features/sites/sitesApi';
import { RISK_COLOR } from '@/utils/severity';
import { getActiveCyclone } from '@/pages/hazards/hazardData';
import { useSkymetSevenDayForecast } from '../useSkymetSevenDayForecast';
import { exportNationalBulletinToPdf, exportNationalBulletinToExcel } from '../exportUtils';
import {
  BULLETIN_SEVERITIES,
  RAIN_WIND_SEVERITY_LABEL,
  HAZARD_SEVERITY_LABEL,
  RAIN_LEGEND,
  WIND_LEGEND,
  TEMPERATURE_LEGEND,
  HAZARD_LEGEND,
  SKYMET_BULLETIN_HAZARD_PERILS,
  REGION_ORDER,
  regionOf,
  districtStateLabel,
  buildStateLookup,
  buildSkymetParameterMatrix,
  buildSkymetHazardRow,
  buildCycloneHazardRow,
  type HazardEntry,
} from '../bulletinData';

const BANNER_BG = '#8e2a8e';
const PANEL_BG = '#f6e6f6';
const PANEL_BORDER = '#c9a0c9';
// The bulletin panel is deliberately styled to look like a fixed, printed
// document (same pale pink in light or dark mode - it's meant to read as
// "official bulletin," not as an app surface). That's intentional. What
// wasn't intentional: text placed directly on PANEL_BG (the severity-scale
// captions under each table, and the Hazard legend table below) had no
// color of its own, so it inherited the app's normal theme text color -
// dark in light mode (fine, reads dark-on-pink) but near-white in dark mode
// (near-white text on this same pale-pink panel, effectively invisible).
// Pinning it to a fixed dark color, same as the panel's own background,
// keeps the "scale" legend readable in both themes.
const PANEL_TEXT = '#3a1440';

function SeverityCell({ label, severity }: { label: string; severity: 'warning' | 'alert' | 'watch' }) {
  return (
    <TableCell sx={{ backgroundColor: RISK_COLOR[severity], color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {label}
    </TableCell>
  );
}

function HazardEntryStack({ entries }: { entries: HazardEntry[] }) {
  if (entries.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        —
      </Typography>
    );
  }
  return (
    <Stack spacing={0.4}>
      {entries.map((e) => (
        <Box
          key={e.name}
          sx={{
            backgroundColor: RISK_COLOR[e.severity],
            color: '#fff',
            fontSize: 10.5,
            fontWeight: 700,
            borderRadius: 0.5,
            px: 0.6,
            py: 0.2,
            lineHeight: 1.4,
          }}
        >
          {e.name}
        </Box>
      ))}
    </Stack>
  );
}

/**
 * The SOW document's "Daily National Bulletin (Planned)" sample: a
 * PAN-India view grouped by macro-region (North/East/West/South/Central/
 * Northeast), each region spanning 3 severity rows for Rainfall and for
 * Wind (cells list the affected states), plus a Hazard Prediction table
 * (Cyclone + 5 other perils) whose cells can stack more than one affected
 * state at more than one severity. See bulletinData.ts for how the
 * matrices are built, and its own doc comments for what's real vs. a
 * necessary simplification of the demo data.
 */
// A pageSize left over from the old ~20-demo-site dataset - the real
// indus_locations table has 57,000+ rows nationwide (see LiveMapPage.tsx's
// own SITE_PAGE_SIZE for the same fix, applied there first). Capping this
// bulletin's own site list at 500 meant it silently worked from an
// arbitrary slice of 500 out of 57,000+ towers, and since only a small,
// scattered subset of towers actually has real hourly_weather/forecast
// data, that slice almost never happened to include any of them - the
// bulletin looked "broken" (no district/state names anywhere) when it was
// actually just never fetching weather for the right towers. The backend
// applies no upper cap on this endpoint, so this is effectively "give me
// every site" - matching LiveMapPage.tsx exactly.
const SITE_PAGE_SIZE = 100000;

export function DailyNationalBulletin() {
  const { data: sitesPage, isLoading: sitesLoading } = useListSitesQuery({ pageSize: SITE_PAGE_SIZE });
  const sites = useMemo(() => sitesPage?.items ?? [], [sitesPage]);
  // Real per-day Skymet vendor outlook (skymet_7daysforecast_data), not the
  // old hourly-derived figures - see useSkymetSevenDayForecast's own doc
  // comment. Replaces both the old noon-snapshot hook (useSevenDayObservations,
  // for Wind + the hazard rows) and the old daily-aggregate hook
  // (useSevenDayForecastTotals, for Rain/Temp) - Skymet reports all three
  // parameters (plus the primitives Landslide/Avalanche/Snowfall need)
  // directly, so a single hook now covers every row in this bulletin.
  const { days, isLoading: skymetLoading } = useSkymetSevenDayForecast(sites);
  const cyclone = useMemo(() => getActiveCyclone(), []);

  const regions = useMemo(() => {
    const present = new Set(sites.map((s) => regionOf(s.state)));
    return REGION_ORDER.filter((r) => present.has(r));
  }, [sites]);

  // Cells name the exact DISTRICT ("Patna (Bihar & Jharkhand)"), not just
  // the whole state - stateByLabel recovers the plain state name behind
  // that combined label so region-row filtering (regionOf needs a bare
  // state) still works. Cyclone's own district warnings carry a real
  // state name too, so they're folded into the same lookup.
  const stateByLabel = useMemo(() => {
    const map = buildStateLookup(sites);
    if (cyclone) {
      cyclone.districtWarnings.forEach((w) => map.set(`${w.district} (${w.state})`, w.state));
    }
    return map;
  }, [sites, cyclone]);

  // Rain Fall, Temperature and Wind all now read the real Skymet per-day
  // figure (rainfall amount, max temperature, max wind speed respectively) -
  // see useSkymetSevenDayForecast's doc comment for why these three (and
  // only these three) come from Skymet.
  const rainMatrix = useMemo(() => buildSkymetParameterMatrix(sites, days, 'rainfall', districtStateLabel), [sites, days]);
  const tempMatrix = useMemo(
    () => buildSkymetParameterMatrix(sites, days, 'temperature', districtStateLabel),
    [sites, days]
  );
  const windMatrix = useMemo(
    () => buildSkymetParameterMatrix(sites, days, 'windSpeed', districtStateLabel),
    [sites, days]
  );

  const hazardRows = useMemo(
    () => [
      {
        key: 'cyclone',
        label: cyclone ? `Cyclone (${cyclone.name})` : 'Cyclone',
        cells: buildCycloneHazardRow(cyclone, days, (district, state) => `${district} (${state})`),
      },
      ...SKYMET_BULLETIN_HAZARD_PERILS.map((peril) => ({
        key: peril.key,
        label: peril.label,
        cells: buildSkymetHazardRow(sites, days, peril, districtStateLabel),
      })),
    ],
    [sites, days, cyclone]
  );

  const shortDays = days.slice(0, 3);
  const longDays = days.slice(3, 7);

  const loading = sitesLoading || skymetLoading;

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button
          size="small"
          variant="outlined"
          startIcon={<TableChartRoundedIcon />}
          disabled={loading || regions.length === 0}
          onClick={() =>
            exportNationalBulletinToExcel({ regions, days, rainMatrix, windMatrix, tempMatrix, hazardRows, stateByLabel })
          }
        >
          Export Excel
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<PictureAsPdfRoundedIcon />}
          disabled={loading || regions.length === 0}
          onClick={() =>
            exportNationalBulletinToPdf({ regions, days, rainMatrix, windMatrix, tempMatrix, hazardRows, stateByLabel })
          }
        >
          Export PDF
        </Button>
      </Stack>

      {loading ? (
        <Typography variant="body2" color="text.secondary">
          Loading bulletin...
        </Typography>
      ) : (
        <Paper variant="outlined" sx={{ overflow: 'hidden', border: `1px solid ${PANEL_BORDER}` }}>
        <Box sx={{ backgroundColor: BANNER_BG, color: '#fff', textAlign: 'center', py: 1 }}>
          <Typography variant="h6" fontWeight={800}>
            Daily Weather Bulletin - PAN India
          </Typography>
        </Box>

        <Box sx={{ backgroundColor: PANEL_BG, p: 2 }}>
          <Stack spacing={3}>
            {(
              [
                { title: 'Rain Fall Prediction', matrix: rainMatrix, legend: RAIN_LEGEND },
                { title: 'Temperature Prediction', matrix: tempMatrix, legend: TEMPERATURE_LEGEND },
                { title: 'Wind Prediction', matrix: windMatrix, legend: WIND_LEGEND },
              ] as const
            ).map((section) => (
              <Box key={section.title}>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { backgroundColor: BANNER_BG, color: '#fff', fontWeight: 700 } }}>
                        <TableCell colSpan={2} align="center">
                          {section.title}
                        </TableCell>
                        <TableCell colSpan={shortDays.length} align="center">
                          Short Range Prediction
                        </TableCell>
                        <TableCell colSpan={longDays.length} align="center">
                          Long Range Prediction
                        </TableCell>
                      </TableRow>
                      <TableRow sx={{ '& th': { backgroundColor: 'action.hover', fontWeight: 700 } }}>
                        <TableCell>Region</TableCell>
                        <TableCell>Severity</TableCell>
                        {days.map((d) => (
                          <TableCell key={d.offset} align="center">
                            {d.label}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {regions.flatMap((region) =>
                        BULLETIN_SEVERITIES.map((sev, sevIdx) => (
                          <TableRow key={`${region}-${sev}`}>
                            {sevIdx === 0 && (
                              <TableCell
                                rowSpan={BULLETIN_SEVERITIES.length}
                                sx={{ fontWeight: 700, verticalAlign: 'top', backgroundColor: 'action.hover' }}
                              >
                                {region}
                              </TableCell>
                            )}
                            <SeverityCell label={RAIN_WIND_SEVERITY_LABEL[sev]} severity={sev} />
                            {days.map((d, i) => {
                              const names = section.matrix[sev][i].filter(
                                (n) => regionOf(stateByLabel.get(n) ?? '') === region
                              );
                              return (
                                <TableCell key={d.offset} align="center" sx={{ fontSize: 11.5 }}>
                                  {names.length > 0 ? names.join(', ') : '—'}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))
                      )}
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
                      <TableCell colSpan={2} align="center">
                        Hazard Prediction
                      </TableCell>
                      <TableCell colSpan={shortDays.length} align="center">
                        Short Range Prediction
                      </TableCell>
                      <TableCell colSpan={longDays.length} align="center">
                        Long Range Prediction
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ '& th': { backgroundColor: 'action.hover', fontWeight: 700 } }}>
                      <TableCell>Region</TableCell>
                      <TableCell>Peril</TableCell>
                      {days.map((d) => (
                        <TableCell key={d.offset} align="center">
                          {d.label}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {regions.flatMap((region) =>
                      hazardRows.map((row, rowIdx) => (
                        <TableRow key={`${region}-${row.key}`}>
                          {rowIdx === 0 && (
                            <TableCell
                              rowSpan={hazardRows.length}
                              sx={{ fontWeight: 700, verticalAlign: 'top', backgroundColor: 'action.hover' }}
                            >
                              {region}
                            </TableCell>
                          )}
                          <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{row.label}</TableCell>
                          {days.map((d, i) => (
                            <TableCell key={d.offset} sx={{ p: 0.5, minWidth: 100 }}>
                              <HazardEntryStack
                                entries={row.cells[i].filter((e) => regionOf(stateByLabel.get(e.name) ?? '') === region)}
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <TableContainer sx={{ mt: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { fontWeight: 700, backgroundColor: 'action.hover', color: PANEL_TEXT } }}>
                      <TableCell>Severity</TableCell>
                      {HAZARD_LEGEND.map((l) => (
                        <TableCell key={l.key} align="center">
                          {l.label}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {BULLETIN_SEVERITIES.map((sev) => (
                      <TableRow key={sev}>
                        <TableCell sx={{ backgroundColor: RISK_COLOR[sev], color: '#fff', fontWeight: 700 }}>
                          {HAZARD_SEVERITY_LABEL[sev]}
                        </TableCell>
                        {HAZARD_LEGEND.map((l) => (
                          <TableCell key={l.key} align="center" sx={{ fontSize: 11.5, color: PANEL_TEXT }}>
                            {l.bands[sev]}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Stack>
        </Box>
        </Paper>
      )}
    </Stack>
  );
}
