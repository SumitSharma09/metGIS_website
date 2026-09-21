import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useTheme } from '@mui/material/styles';
import { chartSeriesColors } from '@/theme/theme';
import type { ChartSeries } from './LineAreaChart';

interface BarChartProps {
  categories: string[];
  series: ChartSeries[];
  height?: number;
  horizontal?: boolean;
  colors?: string[];
}

export function BarChart({ categories, series, height = 300, horizontal = false, colors = chartSeriesColors }: BarChartProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const options: ApexOptions = {
    chart: { toolbar: { show: false }, foreColor: theme.palette.text.secondary, fontFamily: theme.typography.fontFamily },
    colors,
    plotOptions: { bar: { horizontal, borderRadius: 4, columnWidth: '55%' } },
    dataLabels: { enabled: false },
    grid: { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', strokeDashArray: 4 },
    xaxis: { categories, labels: { style: { fontSize: '11px' } }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { style: { fontSize: '11px' } } },
    legend: { show: series.length > 1, position: 'top', horizontalAlign: 'right' },
    tooltip: { theme: isDark ? 'dark' : 'light' },
  };

  return <ReactApexChart options={options} series={series} type="bar" height={height} />;
}
