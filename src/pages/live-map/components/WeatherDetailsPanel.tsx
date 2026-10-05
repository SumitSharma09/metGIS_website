import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import CloudRoundedIcon from '@mui/icons-material/CloudRounded';
import ThermostatRoundedIcon from '@mui/icons-material/ThermostatRounded';
import DeviceThermostatRoundedIcon from '@mui/icons-material/DeviceThermostatRounded';
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import AirRoundedIcon from '@mui/icons-material/AirRounded';
import UmbrellaRoundedIcon from '@mui/icons-material/UmbrellaRounded';
import CellTowerRoundedIcon from '@mui/icons-material/CellTowerRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import type { Site } from '@/features/sites/types';
import {
  useGetCurrentObservationBySiteQuery,
  useGetHistoricalDataQuery,
  useGetForecastQuery,
} from '@/features/weather/weatherApi';
import { formatWithUnit, formatRelative, titleCase } from '@/utils/formatters';
import { hasRealReading } from '@/utils/dataAvailability';
import { NotAvailable } from '@/components/common/NotAvailable';
import { ROUTES } from '@/routes/routePaths';
import { averageOf, averageByPeriod, buildOutlookNarrative, peakRainChance } from '../weatherNarrative';
import { useSkymetSevenDayForecast } from '@/pages/reports/useSkymetSevenDayForecast';
import { StatBox } from './StatBox';

interface WeatherDetailsPanelProps {
  site: Site;
  onClose: () => void;
}

export const WEATHER_DETAILS_PANEL_WIDTH = 340;

/**
 * The right-side detail panel opened by clicking a tower marker, matching
 * the reference product's "Weather details" drawer.
 * <p>
 * Two sections pull from two different sources, deliberately kept visually
 * distinct so neither is mistaken for the other:
 *  - CURRENT READING: the single latest {@code hourly_weather} row for this
 *    tower (GET /weather/current/:siteId) - temperature, feels-like,
 *    humidity, wind speed, rainfall, visibility and sky condition all come
 *    straight from that one row. Its subtitle shows how old that row
 *    actually is (formatRelative(obs.timestamp)), since with hourly source
 *    data "current" can legitimately mean "up to ~1h old", and a tower with
 *    no hourly_weather rows yet will show "--" here rather than a
 *    misleadingly-precise 0.0.
 *  - DAYTIME / NIGHTTIME AVERAGE: aggregated from the last 24h of
 *    {@code hourly_weather} rows (GET /weather/historical) - a trend view,
 *    not "now". This used to be the ONLY thing this panel showed
 *    (mislabeled as if it were the live reading), so a tower with fewer
 *    than 24h of backfilled rows always looked like it had no data at all
 *    even when its very latest reading was live and real. Kept separately
 *    below the current reading so both can be read for what they actually
 *    are.
 *    Temperature and humidity are bucketed into day (06:00-18:00) and
 *    night (18:00-06:00) and averaged within each bucket separately
 *    (see weatherNarrative.ts's averageByPeriod) rather than blended into
 *    one flat 24-hour figure as this used to do - changed 2026-09-22 per
 *    an explicit requirement that stations/readings must be aligned to
 *    the same time-of-day slot before averaging, so a cold overnight
 *    reading can't quietly pull down a number read as "the" temperature.
 *    Wind speed and peak rain chance don't carry the same day/night swing
 *    and are kept as single 24h/7-day figures.
 * <p>
 * No Pressure stat is shown - the backend derives it from a standard-
 * atmosphere/elevation formula rather than a measured column (there is no
 * pressure column in hourly_weather at all), so it isn't a real reading
 * worth surfacing here.
 * <p>
 * There is deliberately no cloud-cover % stat yet - CurrentObservationDto
 * doesn't expose the real hourly_weather.cloud_cover column on the API
 * response (it's only used internally, backend-side, to help classify the
 * "condition"/sky field below), so "SKY" here reports that already-real
 * classification instead of a synthetic percentage until that field is
 * added to the DTO and wired all the way through.
 * <p>
 * CURRENT READING fallback (added 2026-09-22, per explicit request: "if i
 * click any tower then they show me district data okay not show me no live
 * monitored stations"): a tower with no `hourly_weather` rows used to show
 * every CURRENT READING stat as "Not Available". Most real towers are in
 * exactly this state (see the historical note on this file's own earlier
 * fixes), so clicking almost any tower produced a wall of "Not Available".
 * Temperature, Wind Speed, Rainfall (today) and Sky now fall back to that
 * tower's real DISTRICT-level Skymet 7-day outlook for TODAY
 * (useSkymetSevenDayForecast, the same real per-district vendor feed
 * already used by the Reports bulletins and this page's own district
 * panel) when there's no live per-tower reading - clearly labeled as the
 * district's forecast, never presented as if it were this specific tower's
 * own live measurement. Feels Like, Humidity, Visibility and Rainfall (1h)
 * have no Skymet equivalent at all and stay "Not Available" rather than
 * showing a fabricated figure.
 */
export function WeatherDetailsPanel({ site, onClose }: WeatherDetailsPanelProps) {
  const navigate = useNavigate();
  const { data: obs } = useGetCurrentObservationBySiteQuery(site.id, { pollingInterval: 60000 });
  const { data: history = [] } = useGetHistoricalDataQuery({
    siteId: site.id,
    from: dayjs().subtract(24, 'hour').toISOString(),
    to: dayjs().toISOString(),
    interval: 'hourly',
  });
  const { data: forecast = [] } = useGetForecastQuery({ siteId: site.id, days: 7 });

  // Single-site call into the shared district-Skymet hook - reuses the same
  // bulk-fetched, RTK-Query-cached /forecast/skymet/all data every other
  // Skymet-backed view already holds, so this costs no extra network call.
  const siteList = useMemo(() => [site], [site]);
  const { days: skymetDays } = useSkymetSevenDayForecast(siteList);
  const todaySkymet = skymetDays[0]?.bySiteId[site.id];

  const tempByPeriod = averageByPeriod(history, (p) => p.temperature);
  const humidityByPeriod = averageByPeriod(history, (p) => p.humidity);
  const avgWind = averageOf(history, (p) => p.windSpeed);
  const rainChance = peakRainChance(forecast);
  const outlook = buildOutlookNarrative(forecast);
  const readingCountLabel = `${history.length} reading${history.length === 1 ? '' : 's'}`;
  const periodLabel = (count: number) => `${count} reading${count === 1 ? '' : 's'}`;
  // `obs` can come back as a non-null, zero-filled placeholder for a tower
  // with no ingested hourly_weather rows yet (see IndusWeatherService.
  // emptyCurrentObservation on the backend) - `live` is the real gate for
  // whether there's an actual reading to show, not just whether the request
  // resolved.
  const live = hasRealReading(obs);
  const currentReadingSubtitle = live ? formatRelative(obs!.timestamp) : 'No data yet';
  const naReason = 'This tower has no ingested hourly_weather rows yet, and its district has no Skymet figure for this either';
  const districtSubtitle = `${site.district} district · today`;

  // Skymet-derived fallback values for the four CURRENT READING stats that
  // have a real district-level equivalent - null (not a guess) when this
  // tower's district didn't match a Skymet row, or Skymet's own row is
  // missing that specific field for today.
  const fallbackTemp =
    !live && todaySkymet && (todaySkymet.tempMinC != null || todaySkymet.tempMaxC != null)
      ? [todaySkymet.tempMinC, todaySkymet.tempMaxC].filter((v): v is number => v != null)
          .map((v) => Math.round(v))
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .join('–') + '°C'
      : null;
  const fallbackWind =
    !live && todaySkymet && todaySkymet.windSpeedKmh != null
      ? `${formatWithUnit(todaySkymet.windSpeedKmh, 'km/h')}${todaySkymet.windDirection ? ` ${todaySkymet.windDirection}` : ''}`
      : null;
  const fallbackRainToday =
    !live && todaySkymet && todaySkymet.rainfallMm != null ? formatWithUnit(todaySkymet.rainfallMm, 'mm') : null;
  const fallbackSky = !live && todaySkymet ? todaySkymet.description : null;
  const showingDistrictFallback = !live && (fallbackTemp || fallbackWind || fallbackRainToday || fallbackSky);

  return (
    <Paper
      elevation={6}
      sx={{
        position: 'absolute',
        top: 0,
        right: 0,
        height: '100%',
        width: WEATHER_DETAILS_PANEL_WIDTH,
        maxWidth: '92%',
        zIndex: 1200,
        p: 2.5,
        overflowY: 'auto',
        borderRadius: 0,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Typography variant="subtitle1" fontWeight={700}>
          Weather details
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {site.name}, {site.district}, {site.state}
      </Typography>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1 }}>
        <CellTowerRoundedIcon fontSize="small" color="action" />
        <Typography variant="caption" color="text.secondary">
          {site.code} &middot; {site.towerType} tower
        </Typography>
      </Stack>

      <Divider sx={{ my: 2 }} />

      <Typography
        variant="caption"
        fontWeight={700}
        color="text.secondary"
        sx={{ display: 'block', mb: 1, letterSpacing: 0.5 }}
      >
        CURRENT READING
      </Typography>
      {showingDistrictFallback && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mb: 1.5, p: 1, borderRadius: 1, bgcolor: 'action.hover' }}
        >
          No live reading from this tower yet - the figures below marked "{districtSubtitle}" are {site.district}'s
          real Skymet district forecast, not this specific tower's own measurement.
        </Typography>
      )}
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5}>
          <StatBox
            icon={<ThermostatRoundedIcon fontSize="small" />}
            label="TEMPERATURE"
            value={
              live ? formatWithUnit(obs!.temperature, '°C') : fallbackTemp ?? <NotAvailable inline reason={naReason} />
            }
            subtitle={live ? currentReadingSubtitle : fallbackTemp ? districtSubtitle : currentReadingSubtitle}
          />
          <StatBox
            icon={<DeviceThermostatRoundedIcon fontSize="small" />}
            label="FEELS LIKE"
            value={live ? formatWithUnit(obs!.feelsLike, '°C') : <NotAvailable inline reason={naReason} />}
            subtitle={currentReadingSubtitle}
          />
        </Stack>
        <Stack direction="row" spacing={1.5}>
          <StatBox
            icon={<WaterDropRoundedIcon fontSize="small" />}
            label="HUMIDITY"
            value={live ? `${Math.round(obs!.humidity)}%` : <NotAvailable inline reason={naReason} />}
            subtitle="Relative humidity"
          />
          <StatBox
            icon={<AirRoundedIcon fontSize="small" />}
            label="WIND SPEED"
            value={
              live ? formatWithUnit(obs!.windSpeed, 'km/h') : fallbackWind ?? <NotAvailable inline reason={naReason} />
            }
            subtitle={live ? 'Current reading' : fallbackWind ? districtSubtitle : 'Current reading'}
          />
        </Stack>
        <Stack direction="row" spacing={1.5}>
          <StatBox
            icon={<VisibilityRoundedIcon fontSize="small" />}
            label="VISIBILITY"
            value={live ? formatWithUnit(obs!.visibilityKm, 'km') : <NotAvailable inline reason={naReason} />}
            subtitle="Current reading"
          />
          <StatBox
            icon={<CloudRoundedIcon fontSize="small" />}
            label="SKY"
            value={
              live ? titleCase(obs!.condition.replace(/-/g, ' ')) : fallbackSky ?? <NotAvailable inline reason={naReason} />
            }
            subtitle={live ? 'Current condition' : fallbackSky ? districtSubtitle : 'Current condition'}
          />
        </Stack>
        <Stack direction="row" spacing={1.5}>
          <StatBox
            icon={<UmbrellaRoundedIcon fontSize="small" />}
            label="RAINFALL (1H)"
            value={live ? formatWithUnit(obs!.rainfallLastHour, 'mm') : <NotAvailable inline reason={naReason} />}
            subtitle="Last hour"
          />
          <StatBox
            icon={<WaterDropRoundedIcon fontSize="small" />}
            label="RAINFALL (TODAY)"
            value={
              live
                ? formatWithUnit(obs!.rainfallToday, 'mm')
                : fallbackRainToday ?? <NotAvailable inline reason={naReason} />
            }
            subtitle={live ? 'Since midnight' : fallbackRainToday ? districtSubtitle : 'Since midnight'}
          />
        </Stack>
      </Stack>

      {outlook && (
        <>
          <Typography
            variant="caption"
            fontWeight={700}
            color="text.secondary"
            sx={{ display: 'block', mt: 2.5, mb: 1, letterSpacing: 0.5 }}
          >
            FORECAST OUTLOOK
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {outlook}
          </Typography>
        </>
      )}

      <Typography
        variant="caption"
        fontWeight={700}
        color="text.secondary"
        sx={{ display: 'block', mt: 2.5, mb: 1, letterSpacing: 0.5 }}
      >
        DAYTIME AVERAGE (06:00-18:00)
      </Typography>
      <Stack direction="row" spacing={1.5}>
        <StatBox
          icon={<ThermostatRoundedIcon fontSize="small" />}
          label="AVG TEMPERATURE"
          value={tempByPeriod.day.value != null ? formatWithUnit(tempByPeriod.day.value, '°C') : '--'}
          subtitle={periodLabel(tempByPeriod.day.count)}
        />
        <StatBox
          icon={<WaterDropRoundedIcon fontSize="small" />}
          label="AVG HUMIDITY"
          value={humidityByPeriod.day.value != null ? `${Math.round(humidityByPeriod.day.value)}%` : '--'}
          subtitle={periodLabel(humidityByPeriod.day.count)}
        />
      </Stack>

      <Typography
        variant="caption"
        fontWeight={700}
        color="text.secondary"
        sx={{ display: 'block', mt: 2, mb: 1, letterSpacing: 0.5 }}
      >
        NIGHTTIME AVERAGE (18:00-06:00)
      </Typography>
      <Stack direction="row" spacing={1.5}>
        <StatBox
          icon={<ThermostatRoundedIcon fontSize="small" />}
          label="AVG TEMPERATURE"
          value={tempByPeriod.night.value != null ? formatWithUnit(tempByPeriod.night.value, '°C') : '--'}
          subtitle={periodLabel(tempByPeriod.night.count)}
        />
        <StatBox
          icon={<WaterDropRoundedIcon fontSize="small" />}
          label="AVG HUMIDITY"
          value={humidityByPeriod.night.value != null ? `${Math.round(humidityByPeriod.night.value)}%` : '--'}
          subtitle={periodLabel(humidityByPeriod.night.count)}
        />
      </Stack>

      <Typography
        variant="caption"
        fontWeight={700}
        color="text.secondary"
        sx={{ display: 'block', mt: 2, mb: 1, letterSpacing: 0.5 }}
      >
        24-HR AVERAGE
      </Typography>
      <Stack direction="row" spacing={1.5}>
        <StatBox
          icon={<AirRoundedIcon fontSize="small" />}
          label="AVG WIND"
          value={avgWind != null ? formatWithUnit(avgWind, 'km/h') : '--'}
          subtitle={readingCountLabel}
        />
        <StatBox
          icon={<WaterDropRoundedIcon fontSize="small" />}
          label="PEAK RAIN CHANCE"
          value={rainChance != null ? `${Math.round(rainChance)}%` : '--'}
          subtitle={`Next ${forecast.length || 7} days`}
        />
      </Stack>

      <Divider sx={{ my: 2 }} />

      <Stack spacing={1}>
        <Button fullWidth variant="outlined" startIcon={<NotificationsActiveRoundedIcon />} onClick={() => navigate(ROUTES.alerts)}>
          Weather alerts
        </Button>
        <Button fullWidth variant="outlined" startIcon={<DescriptionRoundedIcon />} onClick={() => navigate(ROUTES.reports)}>
          Reports &amp; exports
        </Button>
        <Button
          fullWidth
          size="small"
          endIcon={<OpenInNewRoundedIcon fontSize="small" />}
          onClick={() => navigate(ROUTES.siteDetail(site.id))}
        >
          View full site page
        </Button>
      </Stack>
    </Paper>
  );
}
