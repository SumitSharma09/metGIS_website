import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useTheme } from '@mui/material/styles';
import { chartSeriesColors } from '@/theme/theme';

export interface ChartSeries {
  name: string;
  // `null` entries are allowed (not just `number`) so a caller can leave a
  // real gap in the line for a date with no real reading, instead of being
  // forced to plot a fabricated 0 - ApexCharts renders a `null` point as a
  // break in the line rather than a value. Added for the Comparison page's
  // trend chart (see AccuracyTrendChart.tsx), which now surfaces "no real
  // data for this parameter/day" as an honest gap rather than a misleading
  // zero.
  data: (number | null)[];
}

interface LineAreaChartProps {
  categories: string[];
  series: ChartSeries[];
  type?: 'line' | 'area';
  height?: number;
  yAxisLabel?: string;
  colors?: string[];
  curve?: 'smooth' | 'straight';
}

export function LineAreaChart({
  categories,
  series,
  type = 'area',
  height = 300,
  yAxisLabel,
  colors = chartSeriesColors,
  curve = 'smooth',
}: LineAreaChartProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const options: ApexOptions = {
    chart: {
      toolbar: { show: false },
      zoom: { enabled: false },
      foreColor: theme.palette.text.secondary,
      fontFamily: theme.typography.fontFamily,
    },
    colors,
    dataLabels: { enabled: false },
    stroke: { curve, width: 2 },
    fill: {
      type: type === 'area' ? 'gradient' : 'solid',
      gradient: { opacityFrom: 0.35, opacityTo: 0.02 },
    },
    grid: {
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      strokeDashArray: 4,
    },
    xaxis: {
      categories,
      labels: { style: { fontSize: '11px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      title: yAxisLabel ? { text: yAxisLabel, style: { fontSize: '11px' } } : undefined,
      labels: { style: { fontSize: '11px' } },
    },
    legend: { show: series.length > 1, position: 'top', horizontalAlign: 'right' },
    tooltip: { theme: isDark ? 'dark' : 'light' },
  };

  // Keyed on the category set (2026-09-24, real bug - "for single district in
  // last 1 days and last 2 days data ... overlap below the compare charts"):
  // react-apexcharts updates an already-mounted chart in place via
  // ApexCharts' own `updateOptions`, which doesn't always recompute the
  // chart's real rendered height cleanly when the number of x-axis
  // categories changes drastically between renders (e.g. switching from a
  // wide, unfiltered multi-district comparison with many dates down to one
  // district's 1-2 day window) - the stale, taller internal layout can then
  // visually bleed past this chart's own fixed-height wrapper (see
  // ChartCard.tsx's own overflow:hidden fix) instead of being recomputed to
  // the new, shorter content. Keying by the category list forces React to
  // unmount and remount a fresh chart instance whenever the shape of the
  // data actually changes, rather than trying to reuse - and sometimes
  // mis-resizing - the previous one.
  return (
    <ReactApexChart
      key={categories.join('|')}
      options={options}
      series={series}
      type={type}
      height={height}
    />
  );
}
