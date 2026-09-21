import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import type { TimelineMode, TimelineSpeed } from '../useMapTimeline';

interface TimelineScrubberProps {
  mode: TimelineMode;
  onChangeMode: (mode: TimelineMode) => void;
  days: { offset: number; label: string }[];
  dayOffset: number;
  onChangeOffset: (offset: number) => void;
  hours: { offset: number; dayIndex: number; label: string; dayLabel: string }[];
  hourOffset: number;
  onChangeHourOffset: (offset: number) => void;
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
  playing,
  onTogglePlaying,
  speed,
  onChangeSpeed,
}: TimelineScrubberProps) {
  const isDaily = mode === 'daily';
  const dayMarks = days.map((d) => ({ value: d.offset, label: d.label }));
  // The hourly bar now spans 7 days x 24 hours (168 steps), so labeling
  // every 3rd hour (as the old single-day version did) would overlap into
  // an unreadable wall of text. Instead, only each day's first step (hour 0)
  // gets a text label - the day name - which also doubles as a visual
  // divider between days; every hour in between is still a real,
  // individually selectable step.
  const hourMarks = hours.filter((h) => h.offset % 24 === 0).map((h) => ({ value: h.offset, label: h.dayLabel }));
  const selectedHour = hours[hourOffset];
  const currentLabel = isDaily
    ? days[dayOffset]?.label
    : selectedHour && `${selectedHour.dayLabel}, ${selectedHour.label}`;

  return (
    <Paper
      elevation={4}
      sx={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 1000,
        px: 3,
        py: 1.5,
        backgroundColor: 'background.paper',
        opacity: 0.97,
        display: { xs: 'none', md: 'block' },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={2}>
        <IconButton color="primary" onClick={onTogglePlaying} size="small">
          {playing ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
        </IconButton>

        <ToggleButtonGroup
          size="small"
          exclusive
          value={mode}
          onChange={(_e, value: TimelineMode | null) => value && onChangeMode(value)}
        >
          <ToggleButton value="daily" sx={{ textTransform: 'none', px: 1.25 }}>
            7 Days
          </ToggleButton>
          <ToggleButton value="hourly" sx={{ textTransform: 'none', px: 1.25 }}>
            Hourly
          </ToggleButton>
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />

        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>
          {currentLabel}
        </Typography>

        {isDaily ? (
          <Slider
            value={dayOffset}
            onChange={(_e, value) => onChangeOffset(value as number)}
            min={0}
            max={days.length - 1}
            step={1}
            marks={dayMarks}
            sx={{ flex: 1, mx: 1 }}
          />
        ) : (
          <Slider
            value={hourOffset}
            onChange={(_e, value) => onChangeHourOffset(value as number)}
            min={0}
            max={hours.length - 1}
            step={1}
            marks={hourMarks}
            sx={{ flex: 1, mx: 1 }}
          />
        )}

        <ToggleButtonGroup
          size="small"
          exclusive
          value={speed}
          onChange={(_e, value: TimelineSpeed | null) => value && onChangeSpeed(value)}
        >
          <ToggleButton value={1}>1x</ToggleButton>
          <ToggleButton value={2}>2x</ToggleButton>
          <ToggleButton value={4}>4x</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
    </Paper>
  );
}
