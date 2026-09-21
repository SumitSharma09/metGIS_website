import { useNavigate } from 'react-router-dom';
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
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import AirRoundedIcon from '@mui/icons-material/AirRounded';
import UmbrellaRoundedIcon from '@mui/icons-material/UmbrellaRounded';
import CellTowerRoundedIcon from '@mui/icons-material/CellTowerRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import type { Site } from '@/features/sites/types';
import type { CurrentObservation } from '@/features/weather/types';
import type { ForecastDaySnapshot } from '@/pages/reports/useSevenDayObservations';
import { formatWithUnit } from '@/utils/formatters';
import { ROUTES } from '@/routes/routePaths';
import { StatBox } from './StatBox';
import { WEATHER_DETAILS_PANEL_WIDTH } from './WeatherDetailsPanel';
import {
  averageOfObservations,
  buildNetworkOutlookNarrative,
  summarizeNetworkDay,
  CONDITION_LABEL,
} from '../networkWeatherNarrative';

/** Same idea as averageOfObservations, but for a field that's only present
 *  on real Indus-sourced readings (cloudCoverPercent, precipitationProbability
 *  - both undefined on the mock generator, see features/weather/types.ts).
 *  Averages over whichever towers actually reported the field instead of
 *  treating a missing reading as 0, so one mock tower in the mix doesn't
 *  drag a real district's cloud-cover/rain-chance average toward zero. */
function averageDefined(
  observations: CurrentObservation[],
  pick: (o: CurrentObservation) => number | null | undefined
): number | null {
  const values = observations.map(pick).filter((v): v is number => v != null);
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

interface NetworkWeatherPanelProps {
  sites: Site[];
  observations: Record<string, CurrentObservation>;
  days: ForecastDaySnapshot[];
  onClose: () => void;
  /** Heading shown at the top of the panel - defaults to "Weather details"
   *  (the nationwide (i) button's own label). LiveMapPage overrides this to
   *  the selected district's name when this same panel is reused for a
   *  district click (see `location` below too) - the stats themselves don't
   *  change shape, only which sites/observations get passed in. */
  title?: string;
  /** Subtitle under the heading - defaults to "India". Overridden to
   *  "<State>" for a district-scoped panel. */
  location?: string;
}

/**
 * The nationwide counterpart to WeatherDetailsPanel, opened from the map's
 * (i) info button instead of a tower marker - matching the reference
 * product, where that button opens a "Weather details" drawer summarizing
 * the whole monitored network (tower count, network-wide visibility/fog, a
 * 7-day outlook) with the same jump-off buttons to Alerts and Reports.
 * Every figure here is aggregated from data the rest of the app already
 * fetches (current observations for "now", the same 7-day snapshot the
 * Hazards page's weekly advisories use for the forecast) - nothing is
 * invented just to fill out the shape of the reference screen.
 * <p>
 * Also reused, unchanged apart from `title`/`location`, as the panel opened
 * by clicking a DISTRICT on the choropleth (see LiveMapPage's
 * `handleSelectDistrict`) - same aggregated-stats layout, just scoped down
 * to that one district's monitored towers instead of the whole network.
 * <p>
 * A district here can hold anywhere from a couple of towers to 1,000-2,000
 * of them, so this deliberately never lists individual towers - every
 * figure below is blended across however many towers `sites`/`observations`
 * covers (all of them, whether that's the whole country or one district),
 * the same way the nationwide panel always has.
 */
export function NetworkWeatherPanel({
  sites,
  observations,
  days,
  onClose,
  title = 'Weather details',
  location = 'India',
}: NetworkWeatherPanelProps) {
  const navigate = useNavigate();
  const currentObs = Object.values(observations);

  const avgTemp = averageOfObservations(currentObs, (o) => o.temperature);
  const avgRainfall = averageOfObservations(currentObs, (o) => o.rainfallLastHour);
  const avgWind = averageOfObservations(currentObs, (o) => o.windSpeed);
  const avgVisibility = averageOfObservations(currentObs, (o) => o.visibilityKm);
  const avgCloudCover = averageDefined(currentObs, (o) => o.cloudCoverPercent);
  const avgRainChance = averageDefined(currentObs, (o) => o.precipitationProbability);
  const outlook = buildNetworkOutlookNarrative(days);
  const daySummaries = days.map(summarizeNetworkDay);
  const reportingCountLabel = `${currentObs.length} of ${sites.length} towers reporting`;

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
          {title}
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {location}
      </Typography>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1 }}>
        <CellTowerRoundedIcon fontSize="small" color="action" />
        <Typography variant="caption" color="text.secondary">
          {sites.length} towers
        </Typography>
      </Stack>

      <Divider sx={{ my: 2 }} />

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
        CURRENT CONDITIONS
      </Typography>
      {sites.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No monitored towers here.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1.5}>
            <StatBox
              icon={<ThermostatRoundedIcon fontSize="small" />}
              label="TEMPERATURE"
              value={avgTemp != null ? formatWithUnit(avgTemp, '°C') : '--'}
              subtitle={reportingCountLabel}
            />
            <StatBox
              icon={<UmbrellaRoundedIcon fontSize="small" />}
              label="RAINFALL (1H)"
              value={avgRainfall != null ? formatWithUnit(avgRainfall, 'mm') : '--'}
              subtitle={reportingCountLabel}
            />
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <StatBox
              icon={<AirRoundedIcon fontSize="small" />}
              label="WIND SPEED"
              value={avgWind != null ? formatWithUnit(avgWind, 'km/h') : '--'}
              subtitle={reportingCountLabel}
            />
            <StatBox
              icon={<VisibilityRoundedIcon fontSize="small" />}
              label="VISIBILITY"
              value={avgVisibility != null ? formatWithUnit(avgVisibility, 'km') : '--'}
              subtitle={reportingCountLabel}
            />
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <StatBox
              icon={<CloudRoundedIcon fontSize="small" />}
              label="CLOUD COVER"
              value={avgCloudCover != null ? `${Math.round(avgCloudCover)}%` : '--'}
              subtitle={reportingCountLabel}
            />
            <StatBox
              icon={<WaterDropRoundedIcon fontSize="small" />}
              label="RAIN CHANCE"
              value={avgRainChance != null ? `${Math.round(avgRainChance)}%` : '--'}
              subtitle={reportingCountLabel}
            />
          </Stack>
        </Stack>
      )}

      {daySummaries.some((d) => d.towerCount > 0) && (
        <>
          <Typography
            variant="caption"
            fontWeight={700}
            color="text.secondary"
            sx={{ display: 'block', mt: 2.5, mb: 1, letterSpacing: 0.5 }}
          >
            7-DAY FORECAST
          </Typography>
          <Stack spacing={1}>
            {daySummaries.map((d) => (
              <Stack
                key={d.offset}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ px: 1, py: 0.75, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
              >
                <Typography variant="caption" fontWeight={700} sx={{ width: 68, flexShrink: 0 }}>
                  {d.label}
                </Typography>
                <Typography variant="body2" fontWeight={700} sx={{ width: 44, textAlign: 'right' }}>
                  {d.avgTemp != null ? `${Math.round(d.avgTemp)}°` : '--'}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ width: 48, textAlign: 'right' }}>
                  {d.rainProbabilityPct != null ? `${Math.round(d.rainProbabilityPct)}%` : '--'}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ flex: 1, textAlign: 'right' }} noWrap>
                  {d.dominantCondition ? CONDITION_LABEL[d.dominantCondition] : '--'}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </>
      )}

      <Divider sx={{ my: 2 }} />

      <Stack spacing={1}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<NotificationsActiveRoundedIcon />}
          onClick={() => navigate(ROUTES.alerts)}
        >
          Weather alerts
        </Button>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<DescriptionRoundedIcon />}
          onClick={() => navigate(ROUTES.reports)}
        >
          Reports &amp; exports
        </Button>
        <Button
          fullWidth
          size="small"
          endIcon={<OpenInNewRoundedIcon fontSize="small" />}
          onClick={() => navigate(ROUTES.sites)}
        >
          View all towers
        </Button>
      </Stack>
    </Paper>
  );
}
