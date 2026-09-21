import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useTheme } from '@mui/material/styles';

interface DonutChartProps {
  labels: string[];
  series: number[];
  colors: string[];
  height?: number;
}

export function DonutChart({ labels, series, colors, height = 260 }: DonutChartProps) {
  const theme = useTheme();
  const options: ApexOptions = {
    chart: { foreColor: theme.palette.text.secondary, fontFamily: theme.typography.fontFamily },
    labels,
    colors,
    legend: { position: 'bottom', fontSize: '12px', labels: { colors: theme.palette.text.primary } },
    dataLabels: { enabled: false },
    stroke: { width: 0 },
    tooltip: { theme: theme.palette.mode },
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            // ApexCharts' donut center labels (name/value/total) each ship
            // with their own hardcoded default text color (a fixed dark
            // grey) rather than inheriting `chart.foreColor` - harmless in
            // light mode since dark-on-white still reads fine, but in dark
            // mode that same fixed dark grey sits on the app's dark paper
            // background and becomes effectively invisible. Every donut on
            // the dashboard and reports pages showed this - the slice
            // labels/legend were fine (those DO track foreColor), only the
            // center "Total" figure (and the per-slice value shown on
            // hover) silently disappeared. Pinned all three to real theme
            // tokens so they stay readable in both themes.
            name: { show: true, fontSize: '13px', color: theme.palette.text.secondary },
            value: {
              show: true,
              fontSize: '20px',
              fontWeight: 700,
              color: theme.palette.text.primary,
              offsetY: 4,
            },
            total: {
              show: true,
              label: 'Total',
              fontSize: '13px',
              color: theme.palette.text.secondary,
              formatter: (w) => String(w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0)),
            },
          },
        },
      },
    },
  };

  return <ReactApexChart options={options} series={series} type="donut" height={height} />;
}
