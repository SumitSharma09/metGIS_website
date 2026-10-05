import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** A fixed pixel height for the chart area - only meaningful for a caller
   *  whose chart component does NOT already size itself (older callers, e.g.
   *  DashboardPage/SiteDetailPage/ForecastPage/HistoricalDataPage). When
   *  omitted, this Box applies no height/overflow at all and simply wraps
   *  whatever height the child renders at - see the 2026-09-24 redesign note
   *  below for why the Comparison page now relies on this path instead. */
  height?: number;
  /** Tighter outer padding around the card's title/chart - added 2026-09-24
   *  per an explicit "decrease the size of boundaries card" request on the
   *  Comparison page. Defaults to `false` so every other page using this
   *  card (Dashboard, Site Detail, Forecast, Historical Data, Reports) keeps
   *  its current, roomier padding unchanged - this is opt-in, not a global
   *  size change.
   *  <p>
   *  Padding bumped from 1.5 to 2 (2026-09-25, "size... good lookings" pass):
   *  1.5 was tighter than the Comparison page's other two cards (the data
   *  grid below it and, before this pass, the KPI tiles), which is exactly
   *  the kind of per-section drift that made the page read as three
   *  different designs stacked together rather than one. `compact` now
   *  matches ComparisonGrid.tsx's own CardContent padding exactly - the
   *  outer breathing room around every card on that page is now the same
   *  number, not three separately-tuned ones. */
  compact?: boolean;
}

// 2026-09-24 redesign: this card used to ALWAYS impose a fixed-height,
// overflow:hidden Box around its chart, sized independently from the actual
// chart component's own `height` prop - which meant two numbers (this card's
// `height` and e.g. LineAreaChart's own `height`) had to be kept in sync by
// hand. Every one of this session's "chart overlaps the content below it"
// reports traced back to exactly that: the two numbers drifting apart (an
// ApexCharts legend needing a few more px than the box allowed), even after
// several rounds of just nudging both numbers up. The real fix is to stop
// declaring the height twice at all: AccuracyTrendChart.tsx (Comparison's
// only ChartCard caller now) no longer passes `height` here, so this Box
// applies no fixed height/clip of its own and simply grows to fit whatever
// height the chart underneath it actually renders at - there is no ceiling
// left to overflow past, so this class of bug can't recur for it. Older
// callers that still pass `height` (their own chart component doesn't size
// itself) keep the previous fixed-height/overflow:hidden behavior unchanged.
export function ChartCard({ title, subtitle, actions, children, height, compact = false }: ChartCardProps) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={compact ? { p: 2, '&:last-child': { pb: 2 } } : undefined}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: compact ? 0.75 : 1 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          {actions}
        </Stack>
        <Box sx={height ? { height, overflow: 'hidden' } : undefined}>{children}</Box>
      </CardContent>
    </Card>
  );
}
