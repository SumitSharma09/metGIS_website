import { useMemo } from 'react';
import Grid from '@mui/material/Grid';
import TrackChangesRoundedIcon from '@mui/icons-material/TrackChangesRounded';
import ThermostatRoundedIcon from '@mui/icons-material/ThermostatRounded';
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import RuleRoundedIcon from '@mui/icons-material/RuleRounded';
import { StatCard } from '@/components/common/StatCard';
import type { ComparisonRow } from '../comparisonData';

export function AccuracyKpis({ rows }: { rows: ComparisonRow[] }) {
  const kpis = useMemo(() => {
    if (rows.length === 0) {
      return { overall: 0, tempMae: 0, rainfallMae: 0, count: 0 };
    }
    const overall = rows.reduce((sum, r) => sum + r.accuracyPct, 0) / rows.length;
    const tempMae = rows.reduce((sum, r) => sum + Math.abs(r.forecastTemp - r.actualTemp), 0) / rows.length;
    const rainfallMae = rows.reduce((sum, r) => sum + Math.abs(r.forecastRainfall - r.actualRainfall), 0) / rows.length;
    return { overall, tempMae, rainfallMae, count: rows.length };
  }, [rows]);

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          label="Overall Accuracy"
          value={`${kpis.overall.toFixed(1)}%`}
          icon={<TrackChangesRoundedIcon />}
          color="#2563eb"
          subtitle="Blended temperature + rainfall"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          label="Temperature MAE"
          value={`${kpis.tempMae.toFixed(1)}°C`}
          icon={<ThermostatRoundedIcon />}
          color="#d97706"
          subtitle="Mean absolute error"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          label="Rainfall MAE"
          value={`${kpis.rainfallMae.toFixed(1)} mm`}
          icon={<WaterDropRoundedIcon />}
          color="#0284c7"
          subtitle="Mean absolute error"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          label="Comparisons"
          value={kpis.count}
          icon={<RuleRoundedIcon />}
          color="#7c3aed"
          subtitle="Site-days in selected window"
        />
      </Grid>
    </Grid>
  );
}
