import { useMemo } from 'react';
import Grid from '@mui/material/Grid';
import { ChartCard } from '@/components/common/ChartCard';
import { DonutChart } from '@/components/charts/DonutChart';
import { BarChart } from '@/components/charts/BarChart';
import { RISK_LEVELS, RISK_COLOR, REPORT_RISK_LABEL, getParameterRisk, type RiskLevel } from '@/utils/severity';
import { RISK_PARAMETERS, readingFor } from '../riskAggregation';
import { WEATHER_PARAMETERS } from '@/utils/constants';
import type { SiteRiskRow } from './SiteRiskTable';

export function RiskDistributionCharts({ rows }: { rows: SiteRiskRow[] }) {
  const overallCounts = useMemo(() => {
    const counts: Record<RiskLevel, number> = { warning: 0, alert: 0, watch: 0, none: 0 };
    rows.forEach((r) => {
      counts[r.overallRisk] += 1;
    });
    return counts;
  }, [rows]);

  const byParameter = useMemo(() => {
    const series: Record<RiskLevel, number[]> = { warning: [], alert: [], watch: [], none: [] };
    RISK_PARAMETERS.forEach((parameter) => {
      const counts: Record<RiskLevel, number> = { warning: 0, alert: 0, watch: 0, none: 0 };
      rows.forEach((r) => {
        const risk = getParameterRisk(parameter, readingFor(parameter, r.obs));
        counts[risk] += 1;
      });
      RISK_LEVELS.forEach((level) => series[level].push(counts[level]));
    });
    return series;
  }, [rows]);

  const parameterLabels = RISK_PARAMETERS.map((p) => WEATHER_PARAMETERS.find((wp) => wp.value === p)?.label ?? p);

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <ChartCard title="Overall Site Risk" subtitle="Current snapshot across selected region" height={260}>
          <DonutChart
            labels={RISK_LEVELS.map((l) => REPORT_RISK_LABEL[l])}
            series={RISK_LEVELS.map((l) => overallCounts[l])}
            colors={RISK_LEVELS.map((l) => RISK_COLOR[l])}
            height={260}
          />
        </ChartCard>
      </Grid>
      <Grid item xs={12} md={8}>
        <ChartCard title="Risk Distribution by Parameter" subtitle="Number of sites in each risk band, per parameter" height={280}>
          <BarChart
            categories={parameterLabels}
            series={RISK_LEVELS.map((level) => ({ name: REPORT_RISK_LABEL[level], data: byParameter[level] }))}
            colors={RISK_LEVELS.map((l) => RISK_COLOR[l])}
            height={280}
          />
        </ChartCard>
      </Grid>
    </Grid>
  );
}
