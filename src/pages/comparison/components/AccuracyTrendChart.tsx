import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import { useTheme } from '@mui/material/styles';
import { ChartCard } from '@/components/common/ChartCard';
import { FORECAST_COLOR, ACTUAL_COLOR, type ComparisonRow } from '../comparisonData';

type MetricKey = 'maxTemp' | 'minTemp' | 'rainfall';

const METRICS: Record<
  MetricKey,
  { label: string; shortLabel: string; unit: string; forecastKey: keyof ComparisonRow; actualKey: keyof ComparisonRow }
> = {
  maxTemp: { label: 'Max Temperature', shortLabel: 'Max Temp', unit: '°C', forecastKey: 'forecastMaxTemp', actualKey: 'actualMaxTemp' },
  minTemp: { label: 'Min Temperature', shortLabel: 'Min Temp', unit: '°C', forecastKey: 'forecastMinTemp', actualKey: 'actualMinTemp' },
  rainfall: { label: 'Rainfall', shortLabel: 'Rainfall', unit: ' mm', forecastKey: 'forecastRainfall', actualKey: 'actualRainfall' },
};

interface DatePoint {
  key: string;
  label: string;
  forecast: number | null;
  actual: number | null;
}

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const normalized = max / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

// Grouped vertical bar chart, rebuilt 2026-09-25 ("the size is not visual
// correctly of graph chart") on plain CSS (flex/percentages), not SVG - the
// previous SVG version rendered at a fixed INTRINSIC pixel size to avoid
// repeating the earlier "bars stretched huge for 1-2 categories" bug, but
// that traded one sizing bug for another: a ~250-400px wide chart centered
// inside a card that spans the full page width reads as a small box
// floating in a mostly-empty card - which is exactly what got reported here.
// <p>
// The actual fix is to size the CONTAINER to the card (100% width, a fixed
// height) while keeping each individual BAR capped at a real max width via
// `BAR_WIDTH` below - the two sizing concerns are independent and should
// never have shared one "make the whole chart bigger/smaller" knob. Extra
// horizontal room goes into the GAPS between/around date groups
// (`justifyContent: 'space-evenly'`, `flex-grow` on each group up to its own
// `GROUP_MAX_WIDTH`), never into stretching a bar past its own width - so
// the chart always fills the card's real width, and a bar is never larger
// than it would be with 10 categories on screen. Past ~6 categories, groups
// stop growing (`flex-grow: 0`) and the row scrolls horizontally instead of
// squeezing bars down to illegible slivers.
const BAR_WIDTH = 34;
const BAR_GAP = 8; // between the Forecast/Actual bar within one date's group
const GROUP_MIN_WIDTH = 96;
const GROUP_MAX_WIDTH = 190;
const PLOT_HEIGHT = 240;
const Y_AXIS_WIDTH = 50;
const TICK_COUNT = 4;

export function AccuracyTrendChart({ rows }: { rows: ComparisonRow[] }) {
  const theme = useTheme();
  const [metric, setMetric] = useState<MetricKey>('maxTemp');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const { label, shortLabel, unit, forecastKey, actualKey } = METRICS[metric];

  const points = useMemo<DatePoint[]>(() => {
    const byDate = new Map<string, { forecast: number[]; actual: number[] }>();
    rows.forEach((r) => {
      const entry = byDate.get(r.date) ?? { forecast: [], actual: [] };
      const forecastValue = r[forecastKey] as number | null;
      const actualValue = r[actualKey] as number | null;
      if (forecastValue !== null && forecastValue !== undefined) entry.forecast.push(forecastValue);
      if (actualValue !== null && actualValue !== undefined) entry.actual.push(actualValue);
      byDate.set(r.date, entry);
    });
    const avg = (arr: number[]) => (arr.length ? Number((arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1)) : null);
    return Array.from(byDate.keys())
      .sort()
      .map((d) => {
        const entry = byDate.get(d)!;
        return { key: d, label: dayjs(d).format('D MMM'), forecast: avg(entry.forecast), actual: avg(entry.actual) };
      });
  }, [rows, forecastKey, actualKey]);

  const chartActions = (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={metric}
      onChange={(_e, value: MetricKey | null) => value && setMetric(value)}
      sx={{
        '& .MuiToggleButton-root': { px: 1.5, py: 0.5, fontSize: '0.75rem', fontWeight: 600, textTransform: 'none' },
      }}
    >
      {(Object.keys(METRICS) as MetricKey[]).map((key) => (
        <ToggleButton key={key} value={key}>
          {METRICS[key].shortLabel}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );

  if (points.length === 0) {
    return (
      <ChartCard title={`Forecast vs Actual ${label}`} subtitle="Daily average across districts in scope" compact actions={chartActions}>
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No comparison data for the selected state/district.
          </Typography>
        </Box>
      </ChartCard>
    );
  }

  const values = points.flatMap((p) => [p.forecast, p.actual]).filter((v): v is number => v !== null);
  const domainMax = niceMax(Math.max(1, ...values));
  const rawMin = Math.min(0, ...values);
  const domainMin = rawMin < 0 ? -niceMax(Math.abs(rawMin)) : 0;
  const range = domainMax - domainMin;
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => Number((domainMin + (range * i) / TICK_COUNT).toFixed(1)));

  // Percent-from-TOP of the plot area for a given value - used for both the
  // gridlines/labels and each bar's own top/height, so everything lines up
  // off one shared piece of math regardless of whether the domain dips
  // below zero.
  const topPercentFor = (v: number) => ((domainMax - v) / range) * 100;
  const baselineTopPercent = topPercentFor(0);

  const manyGroups = points.length > 6;

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <ChartCard title={`Forecast vs Actual ${label}`} subtitle="Daily average across districts in scope" compact actions={chartActions}>
      <Box sx={{ display: 'flex' }}>
        {/* Y-axis labels - fixed width column, shared height with the plot. */}
        <Box sx={{ width: Y_AXIS_WIDTH, flexShrink: 0, position: 'relative', height: PLOT_HEIGHT }}>
          {ticks.map((t) => (
            <Typography
              key={t}
              variant="caption"
              color="text.secondary"
              sx={{
                position: 'absolute',
                right: 8,
                top: `${topPercentFor(t)}%`,
                transform: 'translateY(-50%)',
                fontSize: '0.7rem',
                whiteSpace: 'nowrap',
              }}
            >
              {t}
              {unit}
            </Typography>
          ))}
        </Box>

        {/* Plot area - fills 100% of the card's remaining width; this is the
            actual fix (see the comment above the constants). */}
        <Box sx={{ flex: 1, minWidth: 0, position: 'relative', height: PLOT_HEIGHT, overflowX: manyGroups ? 'auto' : 'visible' }}>
          {ticks.map((t) => (
            <Box
              key={t}
              sx={{ position: 'absolute', left: 0, right: 0, top: `${topPercentFor(t)}%`, borderTop: '1px solid', borderColor: 'divider' }}
            />
          ))}
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${baselineTopPercent}%`,
              borderTop: '1px solid',
              borderColor: 'text.disabled',
              zIndex: 1,
            }}
          />

          <Stack
            direction="row"
            justifyContent={manyGroups ? 'flex-start' : 'space-evenly'}
            sx={{ height: '100%', minWidth: manyGroups ? points.length * GROUP_MIN_WIDTH : 'auto' }}
          >
            {points.map((p, i) => {
              const isHovered = hoverIndex === i;
              const forecastTop = p.forecast === null ? null : Math.min(topPercentFor(p.forecast), baselineTopPercent);
              const forecastHeight = p.forecast === null ? 0 : Math.abs(topPercentFor(p.forecast) - baselineTopPercent);
              const actualTop = p.actual === null ? null : Math.min(topPercentFor(p.actual), baselineTopPercent);
              const actualHeight = p.actual === null ? 0 : Math.abs(topPercentFor(p.actual) - baselineTopPercent);

              return (
                <Box
                  key={p.key}
                  onMouseEnter={() => setHoverIndex(i)}
                  onMouseLeave={() => setHoverIndex((cur) => (cur === i ? null : cur))}
                  sx={{
                    position: 'relative',
                    flex: manyGroups ? `0 0 ${GROUP_MIN_WIDTH}px` : `1 1 ${GROUP_MIN_WIDTH}px`,
                    maxWidth: GROUP_MAX_WIDTH,
                    height: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-end',
                    gap: `${BAR_GAP}px`,
                    px: 1,
                    bgcolor: isHovered ? 'action.hover' : 'transparent',
                    borderRadius: 1,
                  }}
                >
                  {/* Forecast bar */}
                  <Box sx={{ position: 'relative', width: BAR_WIDTH, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                    {forecastTop !== null ? (
                      <Box
                        sx={{
                          width: '100%',
                          position: 'absolute',
                          top: `${forecastTop}%`,
                          height: `${forecastHeight}%`,
                          minHeight: 2,
                          bgcolor: FORECAST_COLOR,
                          opacity: isHovered ? 1 : 0.9,
                          borderRadius: '3px 3px 0 0',
                        }}
                      >
                        <Typography
                          sx={{
                            position: 'absolute',
                            top: -18,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            fontSize: '0.66rem',
                            fontWeight: 700,
                            color: 'text.primary',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {p.forecast}
                          {unit}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography
                        sx={{
                          position: 'absolute',
                          bottom: 2,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          fontSize: '0.62rem',
                          color: 'text.disabled',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        N/A
                      </Typography>
                    )}
                  </Box>

                  {/* Actual bar */}
                  <Box sx={{ position: 'relative', width: BAR_WIDTH, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                    {actualTop !== null ? (
                      <Box
                        sx={{
                          width: '100%',
                          position: 'absolute',
                          top: `${actualTop}%`,
                          height: `${actualHeight}%`,
                          minHeight: 2,
                          bgcolor: ACTUAL_COLOR,
                          opacity: isHovered ? 1 : 0.9,
                          borderRadius: '3px 3px 0 0',
                        }}
                      >
                        <Typography
                          sx={{
                            position: 'absolute',
                            top: -18,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            fontSize: '0.66rem',
                            fontWeight: 700,
                            color: 'text.primary',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {p.actual}
                          {unit}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography
                        sx={{
                          position: 'absolute',
                          bottom: 2,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          fontSize: '0.62rem',
                          color: 'text.disabled',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        N/A
                      </Typography>
                    )}
                  </Box>

                  {/* Date label - anchored just under the plot area. */}
                  <Typography
                    variant="caption"
                    fontWeight={600}
                    color="text.secondary"
                    sx={{ position: 'absolute', bottom: -26, left: 0, right: 0, textAlign: 'center', fontSize: '0.72rem' }}
                  >
                    {p.label}
                  </Typography>

                  {/* Hover tooltip for this group. */}
                  {isHovered && hovered && (
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        mb: 1,
                        bgcolor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1.5,
                        boxShadow: 3,
                        p: 1.25,
                        minWidth: 130,
                        pointerEvents: 'none',
                        zIndex: 4,
                      }}
                    >
                      <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.5, whiteSpace: 'nowrap' }}>
                        {dayjs(hovered.key).format('D MMM YYYY')}
                      </Typography>
                      <Stack spacing={0.35}>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Box sx={{ width: 8, height: 8, borderRadius: 0.5, bgcolor: ACTUAL_COLOR, flexShrink: 0 }} />
                          <Typography variant="caption" sx={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                            Actual: <strong>{hovered.actual === null ? 'N/A' : `${hovered.actual}${unit}`}</strong>
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Box sx={{ width: 8, height: 8, borderRadius: 0.5, bgcolor: FORECAST_COLOR, flexShrink: 0 }} />
                          <Typography variant="caption" sx={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                            Forecast: <strong>{hovered.forecast === null ? 'N/A' : `${hovered.forecast}${unit}`}</strong>
                          </Typography>
                        </Stack>
                      </Stack>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Stack>
        </Box>
      </Box>

      {/* Extra bottom space to clear the date labels, which sit absolutely
          positioned below the plot area (see above). */}
      <Box sx={{ height: 22 }} />

      {/* Legend uses filled swatches (matching the bars themselves), not
          dots or lines. */}
      <Stack direction="row" spacing={3} justifyContent="center" sx={{ mt: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: FORECAST_COLOR, flexShrink: 0 }} />
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Forecast
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: ACTUAL_COLOR, flexShrink: 0 }} />
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Actual
          </Typography>
        </Stack>
      </Stack>
    </ChartCard>
  );
}
