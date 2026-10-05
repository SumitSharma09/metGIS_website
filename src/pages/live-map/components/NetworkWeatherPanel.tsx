import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import { alpha } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CloudRoundedIcon from '@mui/icons-material/CloudRounded';
import WbCloudyRoundedIcon from '@mui/icons-material/WbCloudyRounded';
import WbSunnyRoundedIcon from '@mui/icons-material/WbSunnyRounded';
import ThunderstormRoundedIcon from '@mui/icons-material/ThunderstormRounded';
import FilterDramaRoundedIcon from '@mui/icons-material/FilterDramaRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ThermostatRoundedIcon from '@mui/icons-material/ThermostatRounded';
import DeviceThermostatRoundedIcon from '@mui/icons-material/DeviceThermostatRounded';
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import OpacityRoundedIcon from '@mui/icons-material/OpacityRounded';
import AirRoundedIcon from '@mui/icons-material/AirRounded';
import UmbrellaRoundedIcon from '@mui/icons-material/UmbrellaRounded';
import NightsStayRoundedIcon from '@mui/icons-material/NightsStayRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import TodayRoundedIcon from '@mui/icons-material/TodayRounded';
import DateRangeRoundedIcon from '@mui/icons-material/DateRangeRounded';
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import NavigationRoundedIcon from '@mui/icons-material/NavigationRounded';
import type { Site } from '@/features/sites/types';
import type { CurrentObservation, SkymetForecastDay, WeatherCondition } from '@/features/weather/types';
import type { ForecastDaySnapshot } from '@/pages/reports/useSevenDayObservations';
import { useGetSkymetForecastQuery } from '@/features/weather/weatherApi';
import { formatWithUnit } from '@/utils/formatters';
import { ROUTES } from '@/routes/routePaths';
import { StatBox } from './StatBox';
import { WEATHER_DETAILS_PANEL_WIDTH } from './WeatherDetailsPanel';
import {
  summarizeNetworkDay,
  CONDITION_LABEL,
  type NetworkDaySummary,
} from '../networkWeatherNarrative';

/** One accent color + icon per condition, used to give each forecast row a
 *  small tinted "weather chip" instead of plain text - the same idea as a
 *  polished consumer weather app. Colors are literal hex (not theme tokens)
 *  so they read consistently in both light and dark mode and so `alpha()`
 *  can tint them for the chip background. */
const CONDITION_ICON: Record<WeatherCondition, typeof CloudRoundedIcon> = {
  clear: WbSunnyRoundedIcon,
  'partly-cloudy': WbCloudyRoundedIcon,
  cloudy: CloudRoundedIcon,
  rain: UmbrellaRoundedIcon,
  thunderstorm: ThunderstormRoundedIcon,
  fog: FilterDramaRoundedIcon,
  windy: AirRoundedIcon,
};

const CONDITION_COLOR: Record<WeatherCondition, string> = {
  clear: '#f2a93c',
  'partly-cloudy': '#7fa3c4',
  cloudy: '#78899c',
  rain: '#3d7dca',
  thunderstorm: '#7a5cb8',
  fog: '#9aa5ad',
  windy: '#4fb3a5',
};

const FALLBACK_CONDITION_COLOR = '#9aa5ad';

/** Column widths shared between each box's header row and its data rows, so
 *  the day label / condition icon / temperature / rain figures all line up
 *  into clean vertical columns like a real forecast table. Sized to fit the
 *  panel's fixed 340px width (see WEATHER_DETAILS_PANEL_WIDTH) with room to
 *  spare for the Condition column, which is the one column without a fixed
 *  width here - it flexes into whatever space these four leave, and relies
 *  on overflow+ellipsis (set directly on its Typography below, not just a
 *  flex-basis) so a long word like "Thunderstorm" truncates cleanly instead
 *  of spilling into the Temp/Rain columns next to it, which was the cause of
 *  the "condition and temp overlapping" bug. */
const DAY_COL_WIDTH = 66;
const ICON_COL_WIDTH = 28;
const TEMP_COL_WIDTH = 38;
const RAIN_COL_WIDTH = 58;

/** Shorter condition wording just for this narrow row (the full word is
 *  still used in the Hazards/Reports pages and shown here on hover via
 *  Tooltip) - keeps "Partly cloudy"/"Thunderstorm" from needing to truncate
 *  in the first place, on top of the overflow/ellipsis safety net below. */
const SHORT_CONDITION_LABEL: Record<WeatherCondition, string> = {
  clear: 'Clear',
  'partly-cloudy': 'P. cloudy',
  cloudy: 'Cloudy',
  rain: 'Rain',
  thunderstorm: 'T-storm',
  fog: 'Fog',
  windy: 'Windy',
};

/**
 * One 7-day-forecast row. Each parameter still gets its own labeled column
 * (a "CONDITION / TEMP / RAIN" header sits above each box, per the explicit
 * request to "mention the parameter name in this box with data", and the
 * Rain figure is additionally labeled "Rain" inline on every row, per a
 * follow-up request) but the value itself reads like a proper forecast row -
 * a tinted condition icon instead of a bare word, the temperature as the
 * visual anchor, and a rain-chance figure that highlights once the odds are
 * genuinely high. Shared by both the short-range and extended-range boxes.
 * <p>
 * `totalSites` is how many towers are monitored in this scope right now
 * (the same count the "CURRENT CONDITIONS" section above already shows as
 * "N of M towers reporting") - compared against this one day's own
 * `day.towerCount` so a day whose average came from a much smaller set of
 * reporting towers than usual is visibly flagged rather than looking like a
 * plain, equally-trustworthy figure. Added 2026-09-22 after a report of a
 * sharp day-to-day temperature swing (e.g. Ramban district: today notably
 * higher than the next two days) that turned out to need this to diagnose -
 * each day here is a real, independently-sourced row from the underlying
 * per-hour forecast table for that specific date and hour, not a blend of
 * several, but if fewer towers have forecast data ingested that far ahead
 * than report "today", the day's average can shift a lot for that reason
 * alone rather than because the weather itself is genuinely swinging - and
 * up to now there was no way to tell the two apart from this panel.
 */
function ForecastDayRow({ day, totalSites }: { day: NetworkDaySummary; totalSites: number }) {
  const condition = day.dominantCondition;
  const ConditionIcon = condition ? CONDITION_ICON[condition] : CloudRoundedIcon;
  const conditionColor = condition ? CONDITION_COLOR[condition] : FALLBACK_CONDITION_COLOR;
  const conditionLabel = condition ? CONDITION_LABEL[condition] : 'No data';
  const rainPct = day.rainProbabilityPct;
  const highRain = rainPct != null && rainPct >= 50;
  // "Notably fewer towers than this scope actually has" - half is a simple,
  // visible threshold rather than a statistically-tuned one; the point is to
  // catch the "3 stations instead of 40" case, not to be precise.
  const lowSample = totalSites > 0 && day.towerCount > 0 && day.towerCount < totalSites * 0.5;
  const reportingTooltip =
    totalSites > 0
      ? `${day.towerCount} of ${totalSites} towers reporting for this day${
          lowSample ? ' - notably fewer than usual, so this average may be less reliable' : ''
        }`
      : `${day.towerCount} towers reporting for this day`;

  return (
    <Stack spacing={0.35} sx={{ py: 1 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Tooltip title={reportingTooltip} arrow placement="top">
          <Stack direction="row" alignItems="center" spacing={0.4} sx={{ width: DAY_COL_WIDTH, flexShrink: 0 }}>
            <Typography
              variant="body2"
              fontWeight={700}
              noWrap
              sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {day.label}
            </Typography>
            {lowSample && <WarningAmberRoundedIcon sx={{ fontSize: 13, color: 'warning.main', flexShrink: 0 }} />}
          </Stack>
        </Tooltip>

        <Tooltip title={conditionLabel} arrow placement="top">
          <Stack
            alignItems="center"
            justifyContent="center"
            sx={{
              width: ICON_COL_WIDTH,
              height: ICON_COL_WIDTH,
              flexShrink: 0,
              borderRadius: '50%',
              bgcolor: alpha(conditionColor, 0.16),
            }}
          >
            <ConditionIcon sx={{ fontSize: 16, color: conditionColor }} />
          </Stack>
        </Tooltip>

        {/* minWidth: 0 is what lets this flex item shrink below its content's
            natural width instead of pushing Temp/Rain out of the row; overflow
            + textOverflow is what turns that shrinking into a clean "…" cut
            instead of the text visually spilling over the columns next to it. */}
        <Typography
          variant="caption"
          color="text.secondary"
          noWrap
          title={conditionLabel}
          sx={{ flexGrow: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {condition ? SHORT_CONDITION_LABEL[condition] : 'No data'}
        </Typography>

        <Typography
          variant="body2"
          fontWeight={700}
          noWrap
          sx={{
            minWidth: TEMP_COL_WIDTH,
            textAlign: 'right',
            flexShrink: 0,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {day.avgTemp != null ? `${Math.round(day.avgTemp)}°` : '--'}
        </Typography>

        <Stack
          direction="row"
          spacing={0.35}
          alignItems="baseline"
          justifyContent="flex-end"
          sx={{
            minWidth: RAIN_COL_WIDTH,
            flexShrink: 0,
            color: highRain ? '#3d7dca' : 'text.secondary',
          }}
        >
          <Typography variant="caption" noWrap sx={{ opacity: 0.85 }}>
            Rain
          </Typography>
          <Typography
            variant="caption"
            fontWeight={highRain ? 700 : 600}
            noWrap
            sx={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {rainPct != null ? `${Math.round(rainPct)}%` : '--'}
          </Typography>
        </Stack>
      </Stack>

      {/* Second, smaller line - added per explicit request ("in weather
          details and forecast outlook add some more data") on top of the
          Rain/Temp/Condition row above. Wind + Humidity are the same real
          per-tower averages summarizeNetworkDay already computes for the
          Today/Tomorrow highlight card (avgWindSpeed/avgHumidity) - reused
          here rather than re-derived, and left as '--' (never guessed) when
          a day has nothing to average. Indented to align under the
          CONDITION column, past the Day/Icon columns. */}
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        sx={{ pl: `${DAY_COL_WIDTH + ICON_COL_WIDTH + 16}px` }}
      >
        <Stack direction="row" spacing={0.35} alignItems="center">
          <AirRoundedIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {day.avgWindSpeed != null ? `${Math.round(day.avgWindSpeed)} km/h` : '--'}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.35} alignItems="center">
          <OpacityRoundedIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {day.avgHumidity != null ? `${Math.round(day.avgHumidity)}%` : '--'}
          </Typography>
        </Stack>
      </Stack>
    </Stack>
  );
}

/** A small caption-with-icon heading, used for every section of the panel
 *  (Forecast outlook / Current conditions / 7-day forecast) so each section
 *  reads as a deliberate block rather than a plain uppercase label. */
function SectionLabel({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 2.5, mb: 1 }}>
      {icon}
      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ letterSpacing: 0.6 }}>
        {children}
      </Typography>
    </Stack>
  );
}

/**
 * The bordered, tinted card each forecast range (short-range / extended)
 * renders as: a colored header band naming the range, a column-header row
 * naming each parameter, then one ForecastDayRow per day with a divider
 * between rows - the "single box" / "another box" grouping from the
 * request, styled as a proper card rather than a plain outlined list.
 */
function ForecastRangeBox({
  title,
  icon,
  accent,
  days,
  totalSites,
}: {
  title: string;
  icon: ReactNode;
  accent: 'primary' | 'secondary';
  days: NetworkDaySummary[];
  totalSites: number;
}) {
  if (days.length === 0) return null;

  return (
    <Stack
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: (theme) => alpha(theme.palette[accent].main, 0.35),
        boxShadow: (theme) => `0 1px 4px ${alpha(theme.palette.common.black, 0.08)}`,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.75}
        sx={{
          px: 1.5,
          py: 0.85,
          bgcolor: (theme) => alpha(theme.palette[accent].main, 0.14),
        }}
      >
        {icon}
        <Typography variant="caption" fontWeight={700} color={`${accent}.main`} sx={{ letterSpacing: 0.4 }}>
          {title}
        </Typography>
      </Stack>

      <Stack sx={{ px: 1.25, py: 0.25, bgcolor: 'background.paper' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ pt: 0.75 }}>
          <Box sx={{ width: DAY_COL_WIDTH, flexShrink: 0 }} />
          <Box sx={{ width: ICON_COL_WIDTH, flexShrink: 0 }} />
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={700}
            noWrap
            sx={{ flexGrow: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: 0.4 }}
          >
            CONDITION
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={700}
            sx={{ minWidth: TEMP_COL_WIDTH, textAlign: 'right', flexShrink: 0, letterSpacing: 0.4 }}
          >
            TEMP
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={700}
            sx={{ minWidth: RAIN_COL_WIDTH, textAlign: 'right', flexShrink: 0, letterSpacing: 0.4 }}
          >
            RAIN
          </Typography>
        </Stack>
        <Divider sx={{ mt: 0.75 }} />
        <Stack divider={<Divider />}>
          {days.map((d) => (
            <ForecastDayRow key={d.offset} day={d} totalSites={totalSites} />
          ))}
        </Stack>
      </Stack>
    </Stack>
  );
}

/** Small colored dot with a soft expanding pulse ring, looping - the "this
 *  is live/rotating" cue for TodayTomorrowHighlight below. A continuous
 *  gentle pulse reads as "actively updating" without the jarring on/off
 *  flash a literal blink would - see that component's own doc comment for
 *  the exact request this answers. The ring only animates under
 *  `prefers-reduced-motion: no-preference`; the solid dot itself is always
 *  there regardless, so the indicator is still meaningful with motion
 *  reduced, just without the loop. */
function LivePulseDot({ color }: { color: string }) {
  return (
    <Box sx={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          bgcolor: color,
          '@media (prefers-reduced-motion: no-preference)': {
            animation: 'wxLivePulse 1.8s ease-out infinite',
          },
          '@keyframes wxLivePulse': {
            '0%': { transform: 'scale(1)', opacity: 0.6 },
            '100%': { transform: 'scale(2.6)', opacity: 0 },
          },
        }}
      />
      <Box sx={{ position: 'absolute', inset: 0, borderRadius: '50%', bgcolor: color }} />
    </Box>
  );
}

/** Colors for the small stat tiles inside TodayTomorrowHighlight below
 *  (Rain/Wind/Humidity or Cloud) - kept local and separate from
 *  SKYMET_ICON_COLOR further down (rather than reordered to share it) since
 *  JS/TS module evaluation order doesn't matter for values only read inside
 *  a function body that runs later, at render time. `rain`/`wind` intentionally
 *  match SKYMET_ICON_COLOR's own hues so the same phenomenon reads as the
 *  same color everywhere in this panel. */
const HIGHLIGHT_STAT_COLOR = {
  rain: '#3d7dca',
  wind: '#3f9e91',
  humidity: '#22c55e',
  cloud: '#78899c',
};

interface TodayTomorrowStat {
  Icon: typeof CloudRoundedIcon;
  color: string;
  label: string;
  value: string;
}

interface TodayTomorrowItem {
  dayLabel: string;
  Icon: typeof CloudRoundedIcon;
  color: string;
  conditionText: string;
  tempText: string;
  /** Exactly 3 today, per explicit request ("add some more data like wind
   *  speed humidity rain etc") - Rain/Wind/Humidity for the tower-averaged
   *  panel, Rain/Wind/Cloud for the Skymet-scoped one (Skymet's feed has no
   *  humidity field - Cloud stands in rather than a fabricated figure). See
   *  the two call sites that build this (below) for exactly which real
   *  field feeds each one. */
  stats: TodayTomorrowStat[];
}

/**
 * A small auto-rotating "Today / Tomorrow" card shown above the 7-day
 * forecast section - added 2026-09-24 per explicit request ("forecast 7
 * days outlook they above show the today and tommorror data on one by one
 * with blinking some professional way"), then redesigned the same day with
 * more figures and a cleaner look per a follow-up request ("add some more
 * data like wind speed humidity rain etc and card redesign for highlighted
 * colors with good looking"). Structured like a small weather-app "now
 * card" - a colored masthead strip (day name + the live/rotating cue +
 * position dots), then a condition/temperature header, then a row of stat
 * tiles - reusing the same accent-stripe-header language ForecastRangeBox/
 * SkymetForecastBox already use elsewhere in this panel, and the same
 * icon-in-a-tinted-circle + stat-grid language SkymetDayCard's own tiles
 * use, rather than inventing a third visual style for this one card.
 * Crossfades between Today's and Tomorrow's figures every few seconds
 * instead of showing both permanently - `LivePulseDot` is the "blinking"
 * cue, done as a soft pulse rather than a jarring on/off flash, and the
 * small position dots in the masthead make the rotation read as deliberate
 * (a carousel) rather than glitchy. The full day-by-day breakdown is still
 * right below this in the 7-day list - this is a glanceable headline, not a
 * replacement for it. Pauses on hover so the figures don't change out from
 * under the pointer mid-read. Renders nothing for zero real items, and
 * stays on the single item (no rotation, no position dots) when only one of
 * Today/Tomorrow has real data.
 */
function TodayTomorrowHighlight({ items }: { items: TodayTomorrowItem[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (items.length < 2 || paused) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % items.length), 4500);
    return () => window.clearInterval(id);
  }, [items.length, paused]);

  const item = items[Math.min(index, items.length - 1)];
  if (!item) return null;

  return (
    <Box
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        mb: 1.25,
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: (theme) => `0 1px 4px ${alpha(theme.palette.common.black, 0.08)}`,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 1.25, py: 0.6, bgcolor: alpha(item.color, 0.16), transition: 'background-color 0.4s ease' }}
      >
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <LivePulseDot color={item.color} />
          <Typography variant="caption" fontWeight={700} sx={{ color: item.color, letterSpacing: 0.5 }}>
            {item.dayLabel.toUpperCase()}
          </Typography>
        </Stack>
        {items.length > 1 && (
          <Stack direction="row" spacing={0.5}>
            {items.map((_, i) => (
              <Box
                key={i}
                sx={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  bgcolor: i === index ? item.color : alpha(item.color, 0.3),
                  transition: 'background-color 0.3s ease',
                }}
              />
            ))}
          </Stack>
        )}
      </Stack>

      <Stack
        key={index}
        spacing={1}
        sx={{
          p: 1.25,
          bgcolor: 'background.paper',
          animation: 'wxFadeSlide 0.45s ease',
          '@keyframes wxFadeSlide': {
            from: { opacity: 0, transform: 'translateY(3px)' },
            to: { opacity: 1, transform: 'none' },
          },
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <Stack
            alignItems="center"
            justifyContent="center"
            sx={{ width: 40, height: 40, flexShrink: 0, borderRadius: '50%', bgcolor: alpha(item.color, 0.16) }}
          >
            <item.Icon sx={{ fontSize: 22, color: item.color }} />
          </Stack>
          <Stack sx={{ minWidth: 0 }} spacing={0}>
            <Typography variant="h6" fontWeight={700} noWrap sx={{ lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>
              {item.tempText}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {item.conditionText}
            </Typography>
          </Stack>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${item.stats.length}, 1fr)`, gap: 0.75 }}>
          {item.stats.map((s) => (
            <Stack
              key={s.label}
              alignItems="center"
              spacing={0.35}
              sx={{ py: 0.65, borderRadius: 1.5, bgcolor: (theme) => alpha(theme.palette.text.primary, 0.035) }}
            >
              <s.Icon sx={{ fontSize: 16, color: s.color }} />
              <Typography variant="caption" fontWeight={700} noWrap sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {s.value}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9, letterSpacing: 0.3, lineHeight: 1 }}>
                {s.label}
              </Typography>
            </Stack>
          ))}
        </Box>
      </Stack>
    </Box>
  );
}

/**
 * Best-effort icon+color for a Skymet day's own free-text `description`/
 * `icon` fields (e.g. "Sunny", "sunny") - these are the vendor's own
 * vocabulary, not this app's internal WeatherCondition union, so this is a
 * keyword match rather than a lookup table key-ed off an exact enum. Falls
 * back to a plain neutral cloud icon for anything unrecognized - the real
 * `description` text is always shown alongside it regardless (see
 * SkymetDayCard below), so an imperfect icon guess never hides or
 * misrepresents the actual vendor text.
 */
function skymetConditionVisual(description: string, icon: string): { Icon: typeof CloudRoundedIcon; color: string } {
  const text = `${description} ${icon}`.toLowerCase();
  if (text.includes('thunder') || text.includes('storm')) return { Icon: ThunderstormRoundedIcon, color: CONDITION_COLOR.thunderstorm };
  if (text.includes('rain') || text.includes('shower')) return { Icon: UmbrellaRoundedIcon, color: CONDITION_COLOR.rain };
  if (text.includes('fog') || text.includes('mist') || text.includes('haze')) return { Icon: FilterDramaRoundedIcon, color: CONDITION_COLOR.fog };
  if (text.includes('partly')) return { Icon: WbCloudyRoundedIcon, color: CONDITION_COLOR['partly-cloudy'] };
  if (text.includes('cloud') || text.includes('overcast')) return { Icon: CloudRoundedIcon, color: CONDITION_COLOR.cloudy };
  if (text.includes('wind')) return { Icon: AirRoundedIcon, color: CONDITION_COLOR.windy };
  if (text.includes('sun') || text.includes('clear')) return { Icon: WbSunnyRoundedIcon, color: CONDITION_COLOR.clear };
  return { Icon: CloudRoundedIcon, color: FALLBACK_CONDITION_COLOR };
}

/**
 * "Today"/"Tomorrow"/weekday label for a Skymet outlook day, derived from
 * the row's own real `date` field compared against today's actual calendar
 * date - NOT from `day_sequence` alone. `day_sequence` is zero-based (0 is
 * meant to be "today") but only actually IS today if Skymet's feed has been
 * refreshed for today yet; if that day's ingestion run hasn't landed (still
 * showing yesterday's pull), sequence 0's real `date` is yesterday and
 * sequence 1's is today - trusting the sequence number blindly then labels
 * a card "Tomorrow" while showing today's real date underneath it. Fixed
 * 2026-09-22 per exactly that report: a card read "Tomorrow" over a date
 * that was actually today. Comparing the real date is honest either way -
 * once the feed catches up, sequence 0 is "Today" again automatically.
 */
function skymetDayOffset(date: string): number {
  return dayjs(date).startOf('day').diff(dayjs().startOf('day'), 'day');
}

function skymetDayLabel(date: string, weekday: string): string {
  const diff = skymetDayOffset(date);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return weekday;
}

/** 16-point compass abbreviation (as Skymet's own `Wind_shrt` column
 *  spells it, e.g. "SE", "NNW") to degrees, for the small rotated arrow
 *  next to each day's wind reading - the arrow is a visual reinforcement
 *  of the text abbreviation, not a claim of the exact degree Skymet itself
 *  measured (only the compass point is ever given, never a raw degree
 *  value in this table). Points where the arrow's own tip is drawn "up" at
 *  0deg - CSS rotation is clockwise, matching standard compass bearings. */
const WIND_DIRECTION_DEGREES: Record<string, number> = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
  E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
  W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
};

function windDirectionDegrees(shortDir: string | null | undefined): number | null {
  if (!shortDir) return null;
  return WIND_DIRECTION_DEGREES[shortDir.trim().toUpperCase()] ?? null;
}

/**
 * A short "week ahead" summary sentence for the Skymet-scoped panel, built
 * purely from the outlook's own day-level figures (max/min temp,
 * rain-chance) - no tower/site count anywhere in it. Added 2026-09-22 to
 * replace the tower-based "FORECAST OUTLOOK" narrative (`buildNetworkOutlookNarrative`,
 * which reads "Across N monitored towers...") for this panel specifically,
 * per an explicit request that it show only the 7-day outlook with no
 * mention of monitored sites/towers anywhere. Returns null (nothing
 * rendered) if there isn't enough real data to say anything meaningful.
 */
function buildSkymetWeekSummary(days: SkymetForecastDay[]): string | null {
  if (days.length === 0) return null;

  const maxTemps = days.map((d) => d.tempMaxC).filter((v): v is number => v != null);
  const minTemps = days.map((d) => d.tempMinC).filter((v): v is number => v != null);
  if (maxTemps.length === 0 || minTemps.length === 0) return null;

  const rangeLow = Math.round(Math.min(...minTemps));
  const rangeHigh = Math.round(Math.max(...maxTemps));
  let sentence = `Temperatures over the next ${days.length} days range from ${rangeLow}°C to ${rangeHigh}°C.`;

  const rainiest = [...days]
    .filter((d) => d.rainProbabilityPct != null && d.rainProbabilityPct > 0)
    .sort((a, b) => (b.rainProbabilityPct ?? 0) - (a.rainProbabilityPct ?? 0))[0];
  if (rainiest) {
    const label = skymetDayLabel(rainiest.date, rainiest.weekday);
    const when = label === 'Today' || label === 'Tomorrow' ? label.toLowerCase() : `on ${label}`;
    sentence += ` Rain is most likely ${when}, with a ${rainiest.rainProbabilityPct}% chance.`;
  }

  return sentence;
}

/** Small colored circular badge behind a StatBox icon - purely a Skymet-
 *  card visual touch (kept local to this file rather than added to the
 *  shared StatBox component, which plenty of other, plainer stat rows in
 *  this app also use unchanged). */
function statIcon(Icon: typeof CloudRoundedIcon, color: string) {
  return (
    <Box
      sx={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: alpha(color, 0.16),
        color,
        flexShrink: 0,
      }}
    >
      <Icon sx={{ fontSize: 12 }} />
    </Box>
  );
}

const SKYMET_ICON_COLOR = {
  maxTemp: '#e07a3f',
  minTemp: '#3d7dca',
  rain: '#3d7dca',
  rainChance: '#4a90c9',
  wind: '#3f9e91',
  cloud: '#78899c',
  sunrise: '#e0a23f',
  sunset: '#7a5cb8',
};

/**
 * One day's real Skymet outlook, laid out as a small card rather than the
 * older single-line ForecastDayRow above - there's simply more here (max +
 * min temp, rainfall amount + chance, wind speed + direction, cloud,
 * sunrise, sunset, each its own figure) than a 340px-wide single line can
 * hold. Added 2026-09-22 to replace the old hourly-samples-based average
 * for the DISTRICT-scoped panel specifically (see `skymetScope` on
 * NetworkWeatherPanel) - the nationwide panel keeps the older
 * ForecastRangeBox/ForecastDayRow above unchanged, since Skymet's feed is
 * per-district and there's no single row that could stand in for "all of
 * India". Restyled 2026-09-22 (same day) for a more polished, professional
 * look - a colored condition badge in the header, a color-coded icon per
 * stat tile, a rotated compass arrow next to the wind reading so direction
 * reads at a glance rather than as a bare two-letter abbreviation, and a
 * fill bar under cloud cover.
 */
function SkymetDayCard({ day }: { day: SkymetForecastDay }) {
  const { Icon: ConditionIcon, color: conditionColor } = skymetConditionVisual(day.description, day.icon);
  const dateLabel = skymetDayLabel(day.date, day.weekday);
  // Same real-date comparison as the label above (not a raw daySequence
  // check) so the "TODAY"/"TOMORROW" chip styling never disagrees with the
  // text it's styling.
  const isNearTerm = dateLabel === 'Today' || dateLabel === 'Tomorrow';
  const windDeg = windDirectionDegrees(day.windDirection);

  return (
    <Stack
      sx={{
        px: 1.5,
        py: 1.5,
        transition: 'background-color 0.15s ease',
        '&:not(:last-of-type)': { borderBottom: '1px solid', borderColor: 'divider' },
        '&:hover': { bgcolor: (theme) => alpha(theme.palette.text.primary, 0.02) },
      }}
      spacing={1.25}
    >
      <Stack direction="row" alignItems="center" spacing={1.25}>
        <Stack
          alignItems="center"
          justifyContent="center"
          sx={{ width: 36, height: 36, flexShrink: 0, borderRadius: '50%', bgcolor: alpha(conditionColor, 0.16) }}
        >
          <ConditionIcon sx={{ fontSize: 19, color: conditionColor }} />
        </Stack>
        <Stack sx={{ minWidth: 0, flexGrow: 1 }} spacing={0.25}>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            {isNearTerm ? (
              <Chip
                label={dateLabel.toUpperCase()}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  letterSpacing: 0.4,
                  bgcolor: alpha(conditionColor, 0.16),
                  color: conditionColor,
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            ) : (
              <Typography variant="body2" fontWeight={700} noWrap>
                {dateLabel}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" noWrap>
              · {day.date}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" noWrap>
            {day.description}{day.raintext && day.raintext !== 'No Rain' ? ` · ${day.raintext}` : ''}
          </Typography>
        </Stack>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        <StatBox
          icon={statIcon(ThermostatRoundedIcon, SKYMET_ICON_COLOR.maxTemp)}
          label="MAX TEMP"
          value={day.tempMaxC != null ? formatWithUnit(day.tempMaxC, '°C') : '--'}
        />
        <StatBox
          icon={statIcon(DeviceThermostatRoundedIcon, SKYMET_ICON_COLOR.minTemp)}
          label="MIN TEMP"
          value={day.tempMinC != null ? formatWithUnit(day.tempMinC, '°C') : '--'}
        />
        <StatBox
          icon={statIcon(UmbrellaRoundedIcon, SKYMET_ICON_COLOR.rain)}
          label="RAINFALL"
          value={day.rainfallMm != null ? formatWithUnit(day.rainfallMm, 'mm') : '--'}
        />
        <StatBox
          icon={statIcon(WaterDropRoundedIcon, SKYMET_ICON_COLOR.rainChance)}
          label="RAIN CHANCE"
          value={day.rainProbabilityPct != null ? `${day.rainProbabilityPct}%` : '--'}
        />
        <StatBox
          icon={statIcon(AirRoundedIcon, SKYMET_ICON_COLOR.wind)}
          label="WIND"
          value={
            day.windSpeedKmh != null ? (
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <span>{formatWithUnit(day.windSpeedKmh, 'km/h')}</span>
                {day.windDirection && (
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.25,
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: 'text.secondary',
                    }}
                  >
                    {windDeg != null && (
                      <NavigationRoundedIcon sx={{ fontSize: 13, transform: `rotate(${windDeg}deg)` }} />
                    )}
                    {day.windDirection}
                  </Box>
                )}
              </Box>
            ) : (
              '--'
            )
          }
        />
        <StatBox
          icon={statIcon(CloudRoundedIcon, SKYMET_ICON_COLOR.cloud)}
          label="CLOUD COVER"
          value={day.cloudPercent != null ? `${Math.round(day.cloudPercent)}%` : '--'}
          footer={
            day.cloudPercent != null ? (
              <LinearProgress
                variant="determinate"
                value={Math.min(100, Math.max(0, day.cloudPercent))}
                sx={{
                  height: 4,
                  borderRadius: 2,
                  mt: 0.75,
                  bgcolor: (theme) => alpha(theme.palette.text.secondary, 0.14),
                  '& .MuiLinearProgress-bar': { borderRadius: 2, bgcolor: SKYMET_ICON_COLOR.cloud },
                }}
              />
            ) : undefined
          }
        />
        <StatBox
          icon={statIcon(WbSunnyRoundedIcon, SKYMET_ICON_COLOR.sunrise)}
          label="SUNRISE"
          value={day.sunrise ?? '--'}
          subtitle="IST"
        />
        <StatBox
          icon={statIcon(NightsStayRoundedIcon, SKYMET_ICON_COLOR.sunset)}
          label="SUNSET"
          value={day.sunset ?? '--'}
          subtitle="IST"
        />
      </Box>
    </Stack>
  );
}

/** Same card-with-colored-header chrome as ForecastRangeBox above, but for
 *  a list of real Skymet days (SkymetDayCard) instead of the older
 *  hourly-samples-based ForecastDayRow. */
function SkymetForecastBox({
  title,
  icon,
  accent,
  days,
}: {
  title: string;
  icon: ReactNode;
  accent: 'primary' | 'secondary';
  days: SkymetForecastDay[];
}) {
  if (days.length === 0) return null;

  return (
    <Stack
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: (theme) => alpha(theme.palette[accent].main, 0.35),
        boxShadow: (theme) => `0 1px 4px ${alpha(theme.palette.common.black, 0.08)}`,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.75}
        sx={{ px: 1.5, py: 0.85, bgcolor: (theme) => alpha(theme.palette[accent].main, 0.14) }}
      >
        {icon}
        <Typography variant="caption" fontWeight={700} color={`${accent}.main`} sx={{ letterSpacing: 0.4 }}>
          {title}
        </Typography>
      </Stack>
      <Stack sx={{ bgcolor: 'background.paper' }}>
        {days.map((d) => (
          <SkymetDayCard key={d.daySequence} day={d} />
        ))}
      </Stack>
    </Stack>
  );
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
  /** Plain-English hour ("3 PM") the 7-day forecast below is previewing for
   *  every day, tied to the bottom timeline scrubber's current position
   *  (LiveMapPage passes `hourOffset % 24`) - shown next to the "7-DAY
   *  FORECAST" heading so it's clear why the figures change as that slider
   *  moves, instead of looking like an unexplained flicker. Optional so this
   *  component still renders sensibly if a future caller doesn't pass it.
   *  Not used at all when `skymetScope` is set (see below) - the Skymet
   *  feed is one row per calendar day, not per hour, so there's no "preview
   *  hour" concept for it. */
  forecastHourLabel?: string;
  /** When set, this is a DISTRICT-scoped panel and the "7-DAY FORECAST"
   *  section below switches entirely to the real per-day Skymet outlook
   *  (GET /weather/forecast/skymet) instead of the older hourly-samples-
   *  based average - added 2026-09-22 per an explicit request to source
   *  the day-level outlook from Skymet's own max/min temp, rainfall +
   *  chance, wind speed + direction, cloud, and sunrise/sunset, kept as
   *  separate figures rather than blended into one number. Left unset for
   *  the nationwide (i)-button instance, which keeps the older behavior -
   *  Skymet's feed is per-district, so there's no single row that could
   *  stand in for "all of India". */
  skymetScope?: { district: string; state: string };
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
  forecastHourLabel,
  skymetScope,
}: NetworkWeatherPanelProps) {
  const navigate = useNavigate();
  const { data: skymetDays = [], isLoading: skymetLoading } = useGetSkymetForecastQuery(
    skymetScope ?? { district: '', state: '' },
    { skip: !skymetScope }
  );
  // Bucket by the real calendar date, not the raw day_sequence field.
  // day_sequence is only reliable when the feed's ingestion is fresh; if the
  // latest pull is a day (or more) behind, the real dates behind a given
  // sequence value drift and a raw daySequence<=2 / >2 split silently
  // misclassifies cards (e.g. rendering 2 short-range / 5 extended-range
  // instead of the intended 3/4). skymetDayOffset compares the row's real
  // date to today, the same fix already applied to skymetDayLabel above.
  const skymetShortRange = skymetDays.filter((d) => skymetDayOffset(d.date) <= 2);
  const skymetExtendedRange = skymetDays.filter((d) => skymetDayOffset(d.date) > 2);
  const skymetWeekSummary = buildSkymetWeekSummary(skymetDays);
  // Feeds TodayTomorrowHighlight above the Skymet 7-day outlook - real
  // Today (offset 0) and Tomorrow (offset 1) rows only, compared by real
  // calendar date via skymetDayOffset (same reasoning as skymetShortRange
  // above), never invented if one of the two is missing from the feed.
  const skymetTodayTomorrow: TodayTomorrowItem[] = [0, 1]
    .map((offset) => skymetDays.find((d) => skymetDayOffset(d.date) === offset))
    .filter((d): d is SkymetForecastDay => Boolean(d))
    .map((d) => {
      const { Icon, color } = skymetConditionVisual(d.description, d.icon);
      const tempText =
        d.tempMaxC != null && d.tempMinC != null
          ? `${Math.round(d.tempMaxC)}° / ${Math.round(d.tempMinC)}°C`
          : d.tempMaxC != null
            ? `${Math.round(d.tempMaxC)}°C`
            : '--';
      // Skymet's forecast feed has no humidity field, so the third stat here
      // is Cloud Cover (a field Skymet does provide) rather than a fabricated
      // Humidity figure - per the project's standing "never fabricate/
      // mismatch data" rule.
      const stats: TodayTomorrowStat[] = [
        {
          Icon: UmbrellaRoundedIcon,
          color: HIGHLIGHT_STAT_COLOR.rain,
          label: 'Rain',
          value: d.rainProbabilityPct != null ? `${Math.round(d.rainProbabilityPct)}%` : '--',
        },
        {
          Icon: AirRoundedIcon,
          color: HIGHLIGHT_STAT_COLOR.wind,
          label: 'Wind',
          value: d.windSpeedKmh != null ? `${Math.round(d.windSpeedKmh)} km/h` : '--',
        },
        {
          Icon: CloudRoundedIcon,
          color: HIGHLIGHT_STAT_COLOR.cloud,
          label: 'Cloud',
          value: d.cloudPercent != null ? `${Math.round(d.cloudPercent)}%` : '--',
        },
      ];
      return {
        dayLabel: skymetDayLabel(d.date, d.weekday),
        Icon,
        color,
        conditionText: d.description,
        tempText,
        stats,
      };
    });

  const daySummaries = days.map(summarizeNetworkDay);
  // Per explicit request: the first 3 days (short-range, more certain) get
  // their own highlighted box, and the remaining days (extended range, less
  // certain) get a second, differently-colored box - rather than one flat
  // list of up to 7 rows with no visual grouping.
  const shortRangeDays = daySummaries.slice(0, 3);
  const extendedRangeDays = daySummaries.slice(3, 7);
  // Feeds TodayTomorrowHighlight above the tower-averaged 7-day forecast
  // (the nationwide/no-skymetScope branch) - Today is always daySummaries[0]
  // and Tomorrow daySummaries[1] (useSevenDayObservations' own day offsets,
  // see days.ts), skipped individually if that day has no reporting towers
  // rather than showing a fabricated figure.
  const todayTomorrowItems: TodayTomorrowItem[] = daySummaries.slice(0, 2).map((d) => {
    const cond = d.dominantCondition;
    // Real per-tower averages only (avgWindSpeed/avgHumidity come from
    // networkWeatherNarrative.ts's summarizeNetworkDay) - a stat shows '--'
    // rather than a guessed figure when the network has nothing to average
    // for that day.
    const stats: TodayTomorrowStat[] = [
      {
        Icon: UmbrellaRoundedIcon,
        color: HIGHLIGHT_STAT_COLOR.rain,
        label: 'Rain',
        value: d.rainProbabilityPct != null ? `${Math.round(d.rainProbabilityPct)}%` : '--',
      },
      {
        Icon: AirRoundedIcon,
        color: HIGHLIGHT_STAT_COLOR.wind,
        label: 'Wind',
        value: d.avgWindSpeed != null ? `${Math.round(d.avgWindSpeed)} km/h` : '--',
      },
      {
        Icon: OpacityRoundedIcon,
        color: HIGHLIGHT_STAT_COLOR.humidity,
        label: 'Humidity',
        value: d.avgHumidity != null ? `${Math.round(d.avgHumidity)}%` : '--',
      },
    ];
    return {
      dayLabel: d.offset === 0 ? 'Today' : 'Tomorrow',
      Icon: cond ? CONDITION_ICON[cond] : CloudRoundedIcon,
      color: cond ? CONDITION_COLOR[cond] : FALLBACK_CONDITION_COLOR,
      conditionText: cond ? CONDITION_LABEL[cond] : 'No data',
      tempText: d.avgTemp != null ? `${Math.round(d.avgTemp)}°C` : '--',
      stats,
    };
  }).filter((_, i) => daySummaries[i]?.towerCount > 0);

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
      <Stack
        sx={{
          p: 1.75,
          borderRadius: 2,
          background: (theme) =>
            `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.16)} 0%, ${alpha(
              theme.palette.primary.main,
              0.04
            )} 100%)`,
          border: '1px solid',
          borderColor: (theme) => alpha(theme.palette.primary.main, 0.2),
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
            <LocationOnRoundedIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              {title}
            </Typography>
          </Stack>
          <IconButton size="small" onClick={onClose} sx={{ mt: -0.5, mr: -0.5, flexShrink: 0 }}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
        {/* The location line ("India" / the state name) and the raw tower
         *  count both used to sit here - removed per explicit request
         *  ("above show state name, india and towers numbers ... remove") on
         *  top of removing CURRENT CONDITIONS/FORECAST OUTLOOK just below -
         *  `title` alone (the district name, or "Weather details" for the
         *  nationwide panel) is enough to identify what the panel is
         *  showing. */}
      </Stack>

      {/* CURRENT CONDITIONS and the tower-based FORECAST OUTLOOK narrative
       *  (the "Across N monitored towers..." paragraph) were both removed
       *  2026-09-24 per explicit request ("remove the current condition
       *  with the FORECAST OUTLOOK ... this also remove") - they duplicated
       *  figures the redesigned Today/Tomorrow highlight card and the 7-day
       *  list below already show, for both the nationwide (i)-button panel
       *  and a district panel with no skymetScope. The Skymet-scoped
       *  (district) panel already showed ONLY the 7-day outlook, unchanged
       *  by this - `skymetWeekSummary` below remains that panel's own
       *  narrative line, sourced purely from Skymet's day-level figures. */}

      {skymetScope ? (
        skymetLoading ? (
          <>
            <SectionLabel icon={<CalendarMonthRoundedIcon sx={{ fontSize: 16 }} color="primary" />}>
              7-DAY FORECAST OUTLOOK
            </SectionLabel>
            <Typography variant="body2" color="text.secondary">
              Loading {skymetScope.district}'s 7-day outlook…
            </Typography>
          </>
        ) : skymetDays.length > 0 ? (
          <>
            <TodayTomorrowHighlight items={skymetTodayTomorrow} />
            <SectionLabel icon={<CalendarMonthRoundedIcon sx={{ fontSize: 16 }} color="primary" />}>
              7-DAY FORECAST OUTLOOK
            </SectionLabel>
            {skymetWeekSummary && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: -0.5, mb: 1 }}>
                {skymetWeekSummary}
              </Typography>
            )}
            <Stack spacing={1.5}>
              <SkymetForecastBox
                title="SHORT-RANGE · NEXT 3 DAYS"
                icon={<TodayRoundedIcon sx={{ fontSize: 16 }} color="primary" />}
                accent="primary"
                days={skymetShortRange}
              />
              <SkymetForecastBox
                title="EXTENDED · DAYS 4-7"
                icon={<DateRangeRoundedIcon sx={{ fontSize: 16 }} color="secondary" />}
                accent="secondary"
                days={skymetExtendedRange}
              />
            </Stack>
          </>
        ) : (
          <>
            <SectionLabel icon={<CalendarMonthRoundedIcon sx={{ fontSize: 16 }} color="primary" />}>
              7-DAY FORECAST OUTLOOK
            </SectionLabel>
            <Typography variant="body2" color="text.secondary">
              No 7-day outlook available for {skymetScope.district} yet.
            </Typography>
          </>
        )
      ) : (
        daySummaries.some((d) => d.towerCount > 0) && (
          <>
            <TodayTomorrowHighlight items={todayTomorrowItems} />
            <SectionLabel icon={<CalendarMonthRoundedIcon sx={{ fontSize: 16 }} color="primary" />}>
              7-DAY FORECAST
            </SectionLabel>
            {forecastHourLabel && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -0.75, mb: 1 }}>
                Previewing each day at {forecastHourLabel} — drag the timeline slider below to change
              </Typography>
            )}

            <Stack spacing={1.5}>
              <ForecastRangeBox
                title="SHORT-RANGE · NEXT 3 DAYS"
                icon={<TodayRoundedIcon sx={{ fontSize: 16 }} color="primary" />}
                accent="primary"
                days={shortRangeDays}
                totalSites={sites.length}
              />
              <ForecastRangeBox
                title="EXTENDED · DAYS 4-7"
                icon={<DateRangeRoundedIcon sx={{ fontSize: 16 }} color="secondary" />}
                accent="secondary"
                days={extendedRangeDays}
                totalSites={sites.length}
              />
            </Stack>
          </>
        )
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
