import { useMemo, useState } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import dayjs from 'dayjs';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import { EmptyState } from '@/components/common/EmptyState';
import { RISK_COLOR, worseRisk, type RiskLevel } from '@/utils/severity';
import { getActiveCyclone, CYCLONE_WARNING_LABEL } from '@/pages/hazards/hazardData';
import type { Site } from '@/features/sites/types';
import type { ForecastDaySnapshot } from '../useSevenDayObservations';
import { FORECAST_PARAMETERS, NO_DATA_CELL, type ForecastParameterKey, type ForecastCell } from '../forecastParameters';
import { exportShortLongRangeToPdf } from '../exportUtils';

interface ShortLongRangeForecastProps {
  sites: Site[];
  /** Exactly 7 entries (offset 0-6), from useSevenDayObservations - offsets
   *  0-2 render under "Short-Range" and 3-6 under "Long-Range", matching
   *  the scope document's own 3-day-short / 4-more-day-long column split. */
  days: ForecastDaySnapshot[];
}

/**
 * The scope document's "Short and Long-Range Prediction" sample: a
 * per-district table spanning 7 days, with the first 3 columns grouped
 * under "Short-Range Prediction" and the remaining 4 under "Long-Range
 * Prediction" - covering every hazard "Today's Risk Intensity of Districts"
 * already tracks (Rainfall, Temperature, Wind Speed, Humidity, Visibility,
 * Lightning, Flood, Fog, Snowfall, Avalanche), via a tab per parameter,
 * plus a Cyclone tab for the one named, tracked storm system (which isn't
 * a per-district baseline reading, so it gets its own track-timeline panel
 * instead of the shared grid). "Download PDF" exports every tab (one per
 * page) in one branded document.
 */
export function ShortLongRangeForecast({ sites, days }: ShortLongRangeForecastProps) {
  const [paramKey, setParamKey] = useState<ForecastParameterKey>('rainfall');

  const districts = useMemo(() => Array.from(new Set(sites.map((s) => s.district))).sort(), [sites]);
  const siteById = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);

  const shortDays = days.slice(0, 3);
  const longDays = days.slice(3, 7);
  const allDays = [...shortDays, ...longDays];

  // The same live cyclone system the Hazards page's Cyclone Map tracks (see
  // hazardData.ts's getActiveCyclone doc comment) - `null` until a real
  // IMD/JTWC feed is wired in, in which case the tab below shows an honest
  // "no live data" state instead of a fabricated Cyclone Forecast table.
  const cyclone = useMemo(() => getActiveCyclone(), []);

  // Every measurement/hazard parameter's per-district, per-day cell,
  // pre-formatted (display text + color band) - computed once for every
  // parameter (not just the active tab), so the PDF export always has
  // every tab's exact on-screen figures ready, regardless of which tab is
  // currently open.
  const cellsByParam = useMemo(() => {
    const result: Record<string, Record<string, ForecastCell[]>> = {};
    FORECAST_PARAMETERS.forEach((param) => {
      if (param.kind === 'cyclone') return; // has no per-district grid
      result[param.key] = {};
      districts.forEach((district) => {
        result[param.key][district] = allDays.map((day) => {
          const districtObs = day.observations.filter((o) => siteById.get(o.siteId)?.district === district);
          if (districtObs.length === 0) return NO_DATA_CELL;

          if (param.kind === 'measurement') {
            const values = districtObs.map((o) => param.getValue(o));
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            return { band: param.getBand(avg), display: `${avg.toFixed(1)} ${param.unit}` };
          }

          // hazard: worst classification across the district's sites for
          // that day, matching how the Live Map / Risk Intensity dashboard
          // already aggregate hazards (not an averaged number).
          let worst: RiskLevel = 'none';
          districtObs.forEach((o) => {
            const site = siteById.get(o.siteId);
            if (site) worst = worseRisk(worst, param.classify(o, site));
          });
          const band = param.legend.find((b) => b.level === worst) ?? param.legend[param.legend.length - 1];
          return { band, display: band.label };
        });
      });
    });
    return result;
  }, [districts, allDays, siteById]);

  if (districts.length === 0) {
    return <EmptyState message="No sites match the selected region." />;
  }

  const activeParam = FORECAST_PARAMETERS.find((p) => p.key === paramKey)!;
  const isCyclone = activeParam.kind === 'cyclone';

  return (
    <Paper variant="outlined">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        spacing={1}
        sx={{ px: 1.5, pt: 1, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Tabs
          value={paramKey}
          onChange={(_e, v: ForecastParameterKey) => setParamKey(v)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {FORECAST_PARAMETERS.map((p) => (
            <Tab key={p.key} value={p.key} icon={p.icon} iconPosition="start" label={p.label} sx={{ minHeight: 44 }} />
          ))}
        </Tabs>
        <Button
          size="small"
          variant="outlined"
          startIcon={<PictureAsPdfRoundedIcon />}
          sx={{ mb: 1, alignSelf: { xs: 'flex-end', sm: 'center' } }}
          onClick={() => exportShortLongRangeToPdf({ districts, days: allDays, cellsByParam, cyclone })}
        >
          Download PDF
        </Button>
      </Stack>

      {!isCyclone && (
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ px: 1.5, pt: 1.25, pb: 0.75 }}>
          {activeParam.legend.map((b) => (
            <Stack key={b.label} direction="row" spacing={0.5} alignItems="center">
              <Box sx={{ width: 12, height: 12, borderRadius: '2px', backgroundColor: b.bg, flexShrink: 0 }} />
              <Typography variant="caption">
                {b.label}
                {b.rangeLabel ? ` (${b.rangeLabel})` : ''}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
      {activeParam.note && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 1.5, pb: 1 }}>
          {activeParam.note}
        </Typography>
      )}

      {isCyclone ? (
        cyclone ? (
          <Stack spacing={2} sx={{ p: 2, pt: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="subtitle2" fontWeight={700}>
                {cyclone.name}
              </Typography>
              <Chip size="small" variant="outlined" label={cyclone.advisory} />
              <Chip size="small" variant="outlined" label={cyclone.basin} />
            </Stack>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Day</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>
                      Wind Speed
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Classification</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cyclone.track.map((point) => (
                    <TableRow key={point.at}>
                      <TableCell>{dayjs(point.at).format('DD MMM')}</TableCell>
                      <TableCell>{point.observed ? 'Observed' : 'Forecast'}</TableCell>
                      <TableCell align="center">{point.windKmph} km/h</TableCell>
                      <TableCell>{point.classification}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <div>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                District Warnings
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    {cyclone.districtWarnings.map((w) => (
                      <TableRow key={`${w.state}-${w.district}`}>
                        <TableCell>
                          {w.district}, {w.state}
                        </TableCell>
                        <TableCell align="right">
                          <Box
                            sx={{
                              display: 'inline-block',
                              px: 1,
                              py: 0.25,
                              borderRadius: 1,
                              backgroundColor: RISK_COLOR[w.level],
                              color: '#fff',
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {CYCLONE_WARNING_LABEL[w.level]}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </div>
          </Stack>
        ) : (
          <Box sx={{ p: 2, pt: 0 }}>
            <EmptyState message="No live cyclone advisory right now - awaiting a real IMD/JTWC feed." />
          </Box>
        )
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell rowSpan={2} sx={{ fontWeight: 700, verticalAlign: 'bottom' }}>
                  District
                </TableCell>
                <TableCell
                  colSpan={shortDays.length}
                  align="center"
                  sx={{ fontWeight: 700, backgroundColor: 'action.hover' }}
                >
                  Short-Range Prediction (3 Days)
                </TableCell>
                <TableCell
                  colSpan={longDays.length}
                  align="center"
                  sx={{ fontWeight: 700, backgroundColor: 'action.selected' }}
                >
                  Long-Range Prediction (7 Days)
                </TableCell>
              </TableRow>
              <TableRow>
                {shortDays.map((d) => (
                  <TableCell key={d.offset} align="center" sx={{ backgroundColor: 'action.hover' }}>
                    {d.label}
                  </TableCell>
                ))}
                {longDays.map((d) => (
                  <TableCell key={d.offset} align="center" sx={{ backgroundColor: 'action.selected' }}>
                    {d.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {districts.map((district) => (
                <TableRow key={district}>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{district}</TableCell>
                  {cellsByParam[paramKey][district].map((cell, i) => (
                    <TableCell key={i} align="center" sx={{ p: 0.5 }}>
                      <Box
                        sx={{
                          py: 0.5,
                          borderRadius: 1,
                          backgroundColor: cell.band.bg,
                          color: cell.band.text,
                          fontWeight: 700,
                          fontSize: 11,
                        }}
                      >
                        {cell.display}
                      </Box>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}
