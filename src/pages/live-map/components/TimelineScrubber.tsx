import { useMemo } from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { alpha } from '@mui/material/styles';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import type { TimelineMode, TimelineSpeed } from '../useMapTimeline';

/** One accent color per day of the hourly bar's 3-day window (Today/
 *  Tomorrow/the day after) - added 2026-09-24 per explicit request ("make a
 *  professional way slider with some colors"), so each day reads as its own
 *  faint band behind the slider (see `daySegments`/the colored rail below)
 *  instead of one flat gray track. Toned down 2026-09-24 after that first
 *  pass was explicitly disliked ("this not good change this") - kept the
 *  3-day colored bands (still the clearest way to show "today / tomorrow /
 *  the day after" at a glance) but pulled back everything that made it feel
 *  busy: much lower band opacity, no dividing lines between bands, no
 *  separate legend row (the day name already shows via each band's own mark
 *  label), and a plain flat-primary play button in place of the gradient/
 *  glow one. Literal hex (not theme tokens), same convention mapLayers.ts's
 *  own per-parameter LAYER_COLORS uses, so these read consistently in both
 *  light and dark mode. Indexed by `dayIndex` (0/1/2) with a neutral gray
 *  fallback if the window is ever widened past 3 days. */
const DAY_SEGMENT_COLORS = ['#2563eb', '#8b5cf6', '#0d9488'];
const DAY_SEGMENT_FALLBACK_COLOR = '#64748b';

function daySegmentColor(dayIndex: number): string {
  return DAY_SEGMENT_COLORS[dayIndex] ?? DAY_SEGMENT_FALLBACK_COLOR;
}

/** Shared slider styling for both the daily and hourly bars below, so the
 *  two look identical apart from what they scrub through: a slim
 *  primary-to-secondary gradient track (reads as "progress through the
 *  timeline" rather than a plain flat bar), a white ringed thumb that grows
 *  on hover/drag, taller ticks at each day boundary, and a themed value
 *  bubble instead of MUI's plain default styling. Colors come from the
 *  theme (not literals) so this stays correct in both light and dark mode.
 *  Takes `hideRail` so the hourly slider (which sits on top of its own
 *  colored day-segment background - see `daySegments` below) can hide the
 *  plain gray rail underneath it instead of the two overlapping; the daily
 *  slider (no day-segment background) keeps the rail visible as before. */
const getTimelineSliderSx = (hideRail: boolean) =>
  ({
    flex: 1,
    mx: 1,
    height: 6,
    color: 'primary.main',
    '& .MuiSlider-rail': {
      opacity: hideRail ? 0 : 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: (theme: any) => alpha(theme.palette.text.primary, 0.1),
    },
    '& .MuiSlider-track': {
      height: 6,
      border: 'none',
      borderRadius: 3,
      background: (theme: any) => `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
    },
    '& .MuiSlider-thumb': {
      width: 16,
      height: 16,
      backgroundColor: (theme: any) => theme.palette.background.paper,
      border: (theme: any) => `3px solid ${theme.palette.primary.main}`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      transition: 'box-shadow 0.15s ease, width 0.15s ease, height 0.15s ease',
      '&:hover, &.Mui-focusVisible': {
        boxShadow: (theme: any) => `0 0 0 8px ${alpha(theme.palette.primary.main, 0.16)}`,
      },
      '&.Mui-active': {
        width: 18,
        height: 18,
        boxShadow: (theme: any) => `0 0 0 12px ${alpha(theme.palette.primary.main, 0.18)}`,
      },
    },
    '& .MuiSlider-mark': {
      width: 3,
      height: 8,
      borderRadius: 1,
      opacity: 1,
      backgroundColor: (theme: any) => alpha(theme.palette.text.primary, 0.25),
    },
    '& .MuiSlider-markActive': {
      backgroundColor: 'primary.main',
      opacity: 1,
    },
    '& .MuiSlider-markLabel': {
      fontSize: 11,
      fontWeight: 600,
      color: 'text.secondary',
      top: 22,
    },
    '& .MuiSlider-valueLabel': {
      backgroundColor: 'primary.main',
      borderRadius: 1,
      fontSize: 12,
      fontWeight: 700,
      padding: '2px 8px',
    },
  }) as const;

const timelineSliderSx = getTimelineSliderSx(false);

interface TimelineScrubberProps {
  mode: TimelineMode;
  onChangeMode: (mode: TimelineMode) => void;
  days: { offset: number; label: string }[];
  dayOffset: number;
  onChangeOffset: (offset: number) => void;
  hours: { offset: number; dayIndex: number; label: string; dayLabel: string }[];
  hourOffset: number;
  onChangeHourOffset: (offset: number) => void;
  /** Earliest hour position with real (non-fallback) data behind it - see
   *  useMapTimeline.ts's own doc comment on `minHourOffset`. Used as the
   *  hourly Slider's `min` so it can't be dragged into the stretch of today
   *  that predates real ingestion, which is what made the map look frozen
   *  (fixed 2026-09-23 - "if i start the hourly slider then data remains
   *  unchanged for all hours"). */
  minHourOffset: number;
  playing: boolean;
  onTogglePlaying: () => void;
  speed: TimelineSpeed;
  onChangeSpeed: (speed: TimelineSpeed) => void;
}

export function TimelineScrubber({
  mode,
  onChangeMode,
  days,
  dayOffset,
  onChangeOffset,
  hours,
  hourOffset,
  onChangeHourOffset,
  minHourOffset,
  playing,
  onTogglePlaying,
  speed,
  onChangeSpeed,
}: TimelineScrubberProps) {
  // 'daily' mode is disabled as of 2026-09-23 (see useMapTimeline.ts's own
  // header comment) - `mode` is always 'hourly' now, so `isDaily` never
  // evaluates true and the daily-slider branch further down never renders.
  // Left in place (not deleted) so the 7-day bar is a quick revert: re-add
  // its ToggleButtonGroup below and this component needs no other change.
  const isDaily = mode === 'daily';
  const dayMarks = days.map((d) => ({ value: d.offset, label: d.label }));
  // The hourly bar spans 3 days x 24 hours (72 steps - narrowed from 7 days/
  // 168 steps on 2026-09-23, see useMapTimeline.ts), so labeling every 3rd
  // hour (as the old single-day version did) would overlap into an
  // unreadable wall of text. Instead, only each day's first step (hour 0)
  // gets a text label - the day name - which also doubles as a visual
  // divider between days; every hour in between is still a real,
  // individually selectable step.
  // Only marks at/after minHourOffset are reachable (see this file's own
  // `minHourOffset` prop doc comment) - filtering them out here too, not
  // just constraining the Slider's `min` below, avoids showing tick marks
  // for day-boundary hours the user can't actually select.
  const hourMarks = hours
    .filter((h) => h.offset % 24 === 0 && h.offset >= minHourOffset)
    .map((h) => ({ value: h.offset, label: h.dayLabel }));
  const selectedHour = hours[hourOffset];
  const currentLabel = isDaily
    ? days[dayOffset]?.label
    : selectedHour && `${selectedHour.dayLabel}, ${selectedHour.label}`;

  // Contiguous per-day bands (as percentages of the whole hourly bar's
  // width) behind the hourly slider - added 2026-09-24 alongside
  // DAY_SEGMENT_COLORS above, so "Today"/"Tomorrow"/the third day each read
  // as their own colored stretch of track rather than one flat gray bar.
  // Derived from `hours` itself (not hardcoded to 24-hour blocks) so this
  // stays correct if HOURLY_WINDOW_DAYS or the step count ever changes.
  const daySegments = useMemo(() => {
    if (hours.length === 0) return [];
    const segments: { dayIndex: number; label: string; startPct: number; widthPct: number }[] = [];
    let segmentStart = 0;
    for (let i = 1; i <= hours.length; i++) {
      const endOfSegment = i === hours.length || hours[i].dayIndex !== hours[segmentStart].dayIndex;
      if (endOfSegment) {
        segments.push({
          dayIndex: hours[segmentStart].dayIndex,
          label: hours[segmentStart].dayLabel,
          startPct: (segmentStart / hours.length) * 100,
          widthPct: ((i - segmentStart) / hours.length) * 100,
        });
        segmentStart = i;
      }
    }
    return segments;
  }, [hours]);

  // Shared "selected" look for both toggle groups (mode + speed) - a soft
  // tinted fill and primary-colored text/border instead of MUI's plain grey
  // default, so the currently-active choice actually stands out.
  const toggleGroupSx = {
    '& .MuiToggleButton-root': {
      textTransform: 'none',
      fontWeight: 600,
      px: 1.25,
      border: '1px solid',
      borderColor: (theme: any) => alpha(theme.palette.text.primary, 0.15),
      color: 'text.secondary',
    },
    '& .Mui-selected': {
      color: 'primary.main !important',
      backgroundColor: (theme: any) => `${alpha(theme.palette.primary.main, 0.14)} !important`,
      borderColor: (theme: any) => `${alpha(theme.palette.primary.main, 0.4)} !important`,
    },
  } as const;

  return (
    // Positioning (absolute/left/right/bottom/zIndex) used to live directly
    // on this Paper - moved out to the caller (LiveMapPage.tsx) 2026-09-28 so
    // a disclaimer ticker (IndusHullTicker, shown only in the Indus/Towers
    // hull view) can stack directly above this control in one shared
    // bottom-anchored flex column, instead of two separately-positioned
    // absolute elements whose exact vertical gap would have to be guessed at
    // (this component's own height already varies with content - the day
    // segment labels, whether the mode toggle wraps, etc.). Nothing else
    // about this Paper's own look changed.
    <Paper
      elevation={4}
      sx={{
        px: 3,
        py: 1.5,
        borderRadius: 2.5,
        backgroundColor: 'background.paper',
        opacity: 0.97,
        display: { xs: 'none', md: 'block' },
        borderTop: '3px solid',
        borderTopColor: 'primary.main',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={2}>
        {/* Plain flat-primary circle - reverted 2026-09-24 from a gradient
            + glow + hover-scale treatment that was explicitly disliked
            ("this not good change this"). Still colored (not the bare MUI
            default) but restrained: one flat fill, a light resting shadow,
            no motion on hover beyond MUI's own ripple. */}
        <IconButton
          onClick={onTogglePlaying}
          size="small"
          sx={{
            width: 36,
            height: 36,
            color: 'primary.contrastText',
            backgroundColor: 'primary.main',
            boxShadow: (theme) => `0 1px 4px ${alpha(theme.palette.common.black, 0.25)}`,
            '&:hover': {
              backgroundColor: 'primary.dark',
            },
          }}
        >
          {playing ? <PauseRoundedIcon fontSize="small" /> : <PlayArrowRoundedIcon fontSize="small" />}
        </IconButton>

        {/* Daily/Hourly mode toggle - commented out 2026-09-23 per explicit
            request ("remove or comment the 7 days slider and work on only
            3-days hourly wise slider"). The Live Map now shows only the
            hourly bar (see useMapTimeline.ts's 'hourly' default); this
            toggle would otherwise let it switch back to a 7-day daily bar
            that no longer matches the scope document's 3-day short-range
            window. Left here, commented, as a one-step revert:
        <ToggleButtonGroup
          size="small"
          exclusive
          value={mode}
          onChange={(_e, value: TimelineMode | null) => value && onChangeMode(value)}
          sx={toggleGroupSx}
        >
          <ToggleButton value="daily">7 Days</ToggleButton>
          <ToggleButton value="hourly">Hourly</ToggleButton>
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
        */}

        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 168, flexShrink: 0 }}>
          <ScheduleRoundedIcon sx={{ fontSize: 16 }} color="primary" />
          <Typography variant="body2" fontWeight={700} noWrap>
            {currentLabel}
          </Typography>
        </Stack>

        {/* isDaily is always false now that the mode toggle above is
            commented out, so this always renders the hourly slider below -
            left as a ternary (not simplified away) so the daily branch is
            still here, untouched, if the toggle above is ever restored. */}
        {isDaily ? (
          <Slider
            value={dayOffset}
            onChange={(_e, value) => onChangeOffset(value as number)}
            min={0}
            max={days.length - 1}
            step={1}
            marks={dayMarks}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => days[value as number]?.label ?? ''}
            sx={timelineSliderSx}
          />
        ) : (
          // Colored per-day background (see daySegments/DAY_SEGMENT_COLORS
          // above) sits behind the slider itself - the Slider's own rail is
          // hidden (getTimelineSliderSx(true)) so the two don't double up.
          // The gradient track still draws on top, up to the current
          // position, so the colored bands read as "days still ahead" past
          // the thumb and "days already played through" get the primary/
          // secondary progress gradient over them instead.
          <Box sx={{ position: 'relative', flex: 1, mx: 1, display: 'flex', alignItems: 'center' }}>
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                right: 0,
                height: 6,
                borderRadius: 3,
                overflow: 'hidden',
                display: 'flex',
                pointerEvents: 'none',
              }}
            >
              {daySegments.map((seg) => (
                <Box
                  key={seg.dayIndex}
                  sx={{
                    width: `${seg.widthPct}%`,
                    height: '100%',
                    bgcolor: alpha(daySegmentColor(seg.dayIndex), 0.12),
                  }}
                />
              ))}
            </Box>
            <Slider
              value={hourOffset}
              onChange={(_e, value) => onChangeHourOffset(value as number)}
              min={minHourOffset}
              max={hours.length - 1}
              step={1}
              marks={hourMarks}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => {
                const h = hours[value as number];
                return h ? `${h.dayLabel}, ${h.label}` : '';
              }}
              sx={{ ...getTimelineSliderSx(true), flex: 'unset', mx: 0, width: '100%' }}
            />
          </Box>
        )}

        <ToggleButtonGroup
          size="small"
          exclusive
          value={speed}
          onChange={(_e, value: TimelineSpeed | null) => value && onChangeSpeed(value)}
          sx={toggleGroupSx}
        >
          {/* 4x removed / 0.5x added 2026-09-29 - see TimelineSpeed's own doc
              comment in useMapTimeline.ts for why: 4x ticked faster than the
              map's data-fetch debounce could keep up with, so the colors/
              tooltips visibly lagged behind the slider's own position. */}
          <ToggleButton value={0.5}>0.5x</ToggleButton>
          <ToggleButton value={1}>1x</ToggleButton>
          <ToggleButton value={2}>2x</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
    </Paper>
  );
}
