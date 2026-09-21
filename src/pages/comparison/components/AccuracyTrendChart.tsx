import { useMemo } from 'react';
import dayjs from 'dayjs';
import { ChartCard } from '@/components/common/ChartCard';
import { LineAreaChart } from '@/components/charts/LineAreaChart';
import type { ComparisonRow } from '../comparisonData';

/** Daily average forecast vs. actual temperature across the selected sites. */
export function AccuracyTrendChart({ rows }: { rows: ComparisonRow[] }) {
  const { categories, forecastSeries, actualSeries } = useMemo(() => {
    const byDate = new Map<string, { forecast: number[]; actual: number[] }>();
    rows.forEach((r) => {
      const entry = byDate.get(r.date) ?? { forecast: [], actual: [] };
      entry.forecast.push(r.forecastTemp);
      entry.actual.push(r.actualTemp);
      byDate.set(r.date, entry);
    });
    const dates = Array.from(byDate.keys()).sort();
    const avg = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
    return {
      categories: dates.map((d) => dayjs(d).format('D MMM')),
      forecastSeries: dates.map((d) => Number(avg(byDate.get(d)!.forecast).toFixed(1))),
      actualSeries: dates.map((d) => Number(avg(byDate.get(d)!.actual).toFixed(1))),
    };
  }, [rows]);

  return (
    <ChartCard title="Forecast vs Actual Temperature" subtitle="Daily average across selected sites" height={300}>
      <LineAreaChart
        categories={categories}
        series={[
          { name: 'Forecast', data: forecastSeries },
          { name: 'Actual', data: actualSeries },
        ]}
        type="line"
        height={280}
        yAxisLabel="°C"
      />
    </ChartCard>
  );
}
