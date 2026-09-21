import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useTheme } from '@mui/material/styles';
import { chartSeriesColors } from '@/theme/theme';

export interface ChartSeries {
  name: string;
  data: number[];
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

  return <ReactApexChart options={options} series={series} type={type} height={height} />;
}
