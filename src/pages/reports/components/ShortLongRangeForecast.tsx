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
import { RISK_COLOR, worseRisk, getSnowfallRisk, getAvalancheRisk, getParameterRisk, type RiskLevel } from '@/utils/severity';
import { getActiveCyclone, CYCLONE_WARNING_LABEL } from '@/pages/hazards/hazardData';
import type { Site } from '@/features/sites/types';
import type { SkymetForecastDay } from '@/features/weather/types';
import type { ForecastDaySnapshot } from '../useSevenDayObservations';
import type { SkymetDaySnapshot } from '../useSkymetSevenDayForecast';
import { FORECAST_PARAMETERS, NO_DATA_CELL, type ForecastParameterKey, type ForecastCell } from '../forecastParameters';
import { exportShortLongRangeToPdf } from '../exportUtils';

interface ShortLongRangeForecastProps {
  sites: Site[];
  /** Exactly 7 entries (offset 0-6), from useSevenDayObservations - offsets
   *  0-2 render under "Short-Range" and 3-6 under "Long-Range", matching
   *  the scope document's own 3-day-short / 4-more-day-long column split.
   *  Still the source for Humidity, Visibility, Lightning, Flood and Fog -
   *  see `skymetDays` below for why those five stay on this hourly source. */
  days: ForecastDaySnapshot[];
  /** Real per-day Skymet vendor outlook (same 7 offsets, same calendar
   *  days as `days` above) - the source for Rainfall, Temperature, Wind
   *  Speed, Flood, Fog, Avalanche and Snowfall (see
   *  SKYMET_MEASUREMENT_VALUE/SKYMET_HAZARD_CLASSIFY below; there is no
   *  Landslide tab in this table at all, only in the Bulletins). Every
   *  tower in a district shows that SAME district's Skymet figure (Skymet
   *  is a per-district, not per-tower, feed - see
   *  useSkymetSevenDayForecast's own doc comment).
   *  <p>
   *  Flood and Fog were added to this Skymet-sourced group on 2026-09-22,
   *  after a report that they (along with Avalanche) always showed "N/A"
   *  in this table: Flood already had no per-site logic of its own -
   *  `getFloodRisk` is pure `getParameterRisk('rainfall', ...)` - so it
   *  reads Skymet's own daily rainfall figure exactly the way Landslide
   *  already does in the Bulletins. Fog has no numeric Skymet field at all
   *  (no visibility measurement), but Skymet's own day `description`/
   *  `icon`/`raintext` text is still real vendor data and often names fog/
   *  mist/haze conditions explicitly - reusing that text (see
   *  `classifyFogFromSkymetText` below) is a genuine derivation from a real
   *  field, not an invented visibility number. Humidity, Visibility and
   *  Lightning still have no Skymet equivalent of any kind (numeric or
   *  textual) and remain on `days` above. */
  skymetDays: SkymetDaySnapshot[];
}

/** Rainfall/Temperature/Wind Speed tabs read straight off Skymet's own
 *  daily figures - rainfall amount, max temperature, max wind speed
 *  respectively - the three measurement parameters Skymet's schema
 *  actually reports (see useSkymetSevenDayForecast's doc comment). */
const SKYMET_MEASUREMENT_VALUE: Partial<Record<ForecastParameterKey, (d: SkymetForecastDay) => number | null>> = {
  rainfall: (d) => d.rainfallMm,
  temperature: (d) => d.tempMaxC,
  windSpeed: (d) => d.windSpeedKmh,
};

/** Fog has no numeric Skymet field (no visibility figure) - Skymet's own
 *  textual weather description/icon/rain-text for the day IS still real
 *  vendor data though, and often names fog/mist/haze conditions explicitly
 *  (e.g. description "Foggy", icon "fog"). Reusing that real text is a
 *  genuine derivation, not a fabricated number - unlike inventing a
 *  visibility-km estimate Skymet never reported. Returns 'none' (never
 *  null) whenever the day matched but its text doesn't mention fog/mist/
 *  haze - that's a real "vendor didn't forecast fog" reading. A true
 *  NO_DATA_CELL only happens when `d` itself is absent (the district never
 *  matched a Skymet row for that day at all), handled by the caller before
 *  this function is ever called. */
function classifyFogFromSkymetText(d: SkymetForecastDay): RiskLevel {
  const text = `${d.description} ${d.icon} ${d.raintext}`.toLowerCase();
  if (text.includes('fog')) return 'alert';
  if (text.includes('mist') || text.includes('haze')) return 'watch';
  return 'none';
}

/** Flood/Fog/Snowfall/Avalanche are the four Tower Risk hazard tabs whose
 *  classify functions (severity.ts, or classifyFogFromSkymetText above) take
 *  plain numeric/textual primitives rather than a full CurrentObservation,
 *  so they can be fed Skymet's own daily rainfall/max temperature/max wind
 *  speed/description directly and honestly. (Landslide isn't a tab in this
 *  table at all - only the Bulletins have a Landslide row.) Returns null
 *  (never a guessed risk) when a day's Skymet figures don't cover what the
 *  peril needs - Flood is the only one of these four that can still fall
 *  through to NO_DATA_CELL this way (a day with no rainfall figure at all);
 *  Fog always resolves to a real RiskLevel once `d` exists, per
 *  classifyFogFromSkymetText's own doc comment. Avalanche treats a missing
 *  windSpeedKmh as calm (0) rather than bailing out entirely - wind is only
 *  a boost on top of the snow/elevation/temperature base score (see
 *  getAvalancheRisk), so a missing wind reading shouldn't blank out an
 *  otherwise-real estimate; this was the actual cause of Avalanche still
 *  showing "N/A" even after it was first migrated onto Skymet, since
 *  Skymet's wind_spd column is null for a real fraction of rows. */
const SKYMET_HAZARD_CLASSIFY: Partial<Record<ForecastParameterKey, (d: SkymetForecastDay, site: Site) => RiskLevel | null>> = {
  flood: (d) => (d.rainfallMm == null ? null : getParameterRisk('rainfall', d.rainfallMm)),
  fog: (d) => classifyFogFromSkymetText(d),
  snowfall: (d, s) => (d.tempMaxC == null ? null : getSnowfallRisk(s.elevationMeters, d.tempMaxC)),
  avalanche: (d, s) => (d.tempMaxC == null ? null : getAvalancheRisk(s.elevationMeters, d.tempMaxC, d.windSpeedKmh ?? 0)),
};

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
export function ShortLongRangeForecast({ sites, days, skymetDays }: ShortLongRangeForecastProps) {
  const [paramKey, setParamKey] = useState<ForecastParameterKey>('rainfall');

  const districts = useMemo(() => Array.from(new Set(sites.map((s) => s.district))).sort(), [sites]);
  const siteById = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);
  const sitesByDistrict = useMemo(() => {
    const map = new Map<string, Site[]>();
    sites.forEach((s) => {
      const list = map.get(s.district);
      if (list) list.push(s);
      else map.set(s.district, [s]);
    });
    return map;
  }, [sites]);

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
      const skymetValueFor = SKYMET_MEASUREMENT_VALUE[param.key];
      const skymetClassifyFor = SKYMET_HAZARD_CLASSIFY[param.key];

      districts.forEach((district) => {
        const districtSites = sitesByDistrict.get(district) ?? [];

        result[param.key][district] = allDays.map((day, dayIndex) => {
          // Rainfall/Temperature/Wind Speed (measurement) and Snowfall/
          // Avalanche (hazard) are sourced from the real Skymet per-day
          // outlook, shared identically by every tower in the district -
          // see skymetDays' own doc comment on the props interface above.
          if (skymetValueFor && param.kind === 'measurement') {
            const skymetDay = skymetDays[dayIndex];
            const values = districtSites
              .map((s) => skymetDay?.bySiteId[s.id])
              .filter((d): d is SkymetForecastDay => Boolean(d))
              .map((d) => skymetValueFor(d))
              .filter((v): v is number => v !== null);
            if (values.length === 0) return NO_DATA_CELL;
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            return { band: param.getBand(avg), display: `${avg.toFixed(1)} ${param.unit}` };
          }

          if (skymetClassifyFor && param.kind === 'hazard') {
            const skymetDay = skymetDays[dayIndex];
            let worst: RiskLevel | null = null;
            districtSites.forEach((s) => {
              const d = skymetDay?.bySiteId[s.id];
              if (!d) return;
              const risk = skymetClassifyFor(d, s);
              if (risk !== null) worst = worst ? worseRisk(worst, risk) : risk;
            });
            if (worst === null) return NO_DATA_CELL;
            const band = param.legend.find((b) => b.level === worst) ?? param.legend[param.legend.length - 1];
            return { band, display: band.label };
          }

          // Everything else (Humidity, Visibility, Lightning) - Skymet's own
          // schema has no numeric or textual field for any of these, so
          // they stay honestly sourced from the hourly noon-snapshot
          // observations rather than showing a fabricated figure.
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
  }, [districts, allDays, siteById, sitesByDistrict, skymetDays]);

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
                  Long-Range Prediction (4 Days)
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
