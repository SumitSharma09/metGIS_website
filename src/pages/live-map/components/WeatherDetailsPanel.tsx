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
import { averageOf, buildOutlookNarrative, peakRainChance } from '../weatherNarrative';
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
 *  - 24-HR AVERAGE: aggregated from the last 24h of {@code hourly_weather}
 *    rows (GET /weather/historical) - a trend view, not "now". This used to
 *    be the ONLY thing this panel showed (mislabeled as if it were the
 *    live reading), so a tower with fewer than 24h of backfilled rows
 *    always looked like it had no data at all even when its very latest
 *    reading was live and real. Kept separately below the current reading
 *    so both can be read for what they actually are.
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

  const avgTemp = averageOf(history, (p) => p.temperature);
  const avgHumidity = averageOf(history, (p) => p.humidity);
  const avgWind = averageOf(history, (p) => p.windSpeed);
  const rainChance = peakRainChance(forecast);
  const outlook = buildOutlookNarrative(forecast);
  const readingCountLabel = `${history.length} reading${history.length === 1 ? '' : 's'}`;
  // `obs` can come back as a non-null, zero-filled placeholder for a tower
  // with no ingested hourly_weather rows yet (see IndusWeatherService.
  // emptyCurrentObservation on the backend) - `live` is the real gate for
  // whether there's an actual reading to show, not just whether the request
  // resolved.
  const live = hasRealReading(obs);
  const currentReadingSubtitle = live ? formatRelative(obs!.timestamp) : 'No data yet';
  const naReason = 'This tower has no ingested hourly_weather rows yet';

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
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5}>
          <StatBox
            icon={<ThermostatRoundedIcon fontSize="small" />}
            label="TEMPERATURE"
            value={live ? formatWithUnit(obs!.temperature, '°C') : <NotAvailable inline reason={naReason} />}
            subtitle={currentReadingSubtitle}
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
            value={live ? formatWithUnit(obs!.windSpeed, 'km/h') : <NotAvailable inline reason={naReason} />}
            subtitle="Current reading"
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
            value={live ? titleCase(obs!.condition.replace(/-/g, ' ')) : <NotAvailable inline reason={naReason} />}
            subtitle="Current condition"
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
            value={live ? formatWithUnit(obs!.rainfallToday, 'mm') : <NotAvailable inline reason={naReason} />}
            subtitle="Since midnight"
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
        24-HR AVERAGE
      </Typography>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5}>
          <StatBox
            icon={<ThermostatRoundedIcon fontSize="small" />}
            label="AVG TEMPERATURE"
            value={avgTemp != null ? formatWithUnit(avgTemp, '°C') : '--'}
            subtitle={readingCountLabel}
          />
          <StatBox
            icon={<WaterDropRoundedIcon fontSize="small" />}
            label="AVG HUMIDITY"
            value={avgHumidity != null ? `${Math.round(avgHumidity)}%` : '--'}
            subtitle="Relative humidity"
          />
        </Stack>
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
