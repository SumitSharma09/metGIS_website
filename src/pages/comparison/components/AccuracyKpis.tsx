import { useMemo, type ReactNode } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TrackChangesRoundedIcon from '@mui/icons-material/TrackChangesRounded';
import ThermostatRoundedIcon from '@mui/icons-material/ThermostatRounded';
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import { useTheme } from '@mui/material/styles';
import {
  accuracyForRow,
  temperatureAccuracyForRow,
  rainfallAccuracyForRow,
  accuracyColor,
  type ComparisonRow,
} from '../comparisonData';

interface KpiCardSpec {
  label: string;
  subtitle: string;
  pct: number | null;
  icon: ReactNode;
}

/** One plain icon-left KPI card - fixed accent color (never the traffic-light
 *  accuracyColor), so the icon reads as "what this card is about" and the
 *  value's own color is the only thing that carries the good/warning/error
 *  judgement. This mirrors the reference design (page 10 of the user's own
 *  "Scope Document for POC - Weather Partner" PDF, supplied 2026-09-25 as the
 *  literal target for this section): label on top, big value below, icon in
 *  a small tinted badge to the left - no gauge, no dense secondary-metric
 *  grid. */
function KpiCard({ label, subtitle, pct, icon }: KpiCardSpec) {
  const theme = useTheme();
  const valueColor = pct === null ? theme.palette.text.primary : theme.palette[accuracyColor(pct)].main;

  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 0 }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Stack direction="row" spacing={1.75} alignItems="center">
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
              opacity: 0.92,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={700}
              noWrap
              sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.7rem' }}
            >
              {label}
            </Typography>
            <Typography variant="h4" fontWeight={700} noWrap sx={{ lineHeight: 1.15, color: valueColor }}>
              {pct === null ? 'N/A' : `${pct.toFixed(1)}%`}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {subtitle}
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

/**
 * Full rewrite, 2026-09-25 - the user supplied a concrete visual reference
 * (page 10 of their own "Scope Document for POC - Weather Partner" PDF) after
 * several rounds of the previous hero-gauge + 4-secondary-metric design being
 * rejected as "unprofessional". That page shows three same-weight, icon-left
 * cards reporting plain accuracy percentages - Overall, Temperature,
 * Rainfall - not a radial gauge next to MAE tiles. This replaces the gauge
 * entirely: `temperatureAccuracyForRow`/`rainfallAccuracyForRow`
 * (comparisonData.ts) split the existing 3-parameter blend so each card has
 * its own real, null-safe percentage rather than a mean-absolute-error
 * value. All three still use the same `accuracyColor` success/warning/error
 * scale as the data grid's own accuracy chip, so the color language stays
 * consistent across the page. */
export function AccuracyKpis({ rows }: { rows: ComparisonRow[] }) {
  const kpis = useMemo(() => {
    const mean = (scores: number[]) =>
      scores.length ? Number((scores.reduce((sum, v) => sum + v, 0) / scores.length).toFixed(1)) : null;

    const overall = mean(rows.map(accuracyForRow).filter((v): v is number => v !== null));
    const temperature = mean(rows.map(temperatureAccuracyForRow).filter((v): v is number => v !== null));
    const rainfall = mean(rows.map(rainfallAccuracyForRow).filter((v): v is number => v !== null));

    return { overall, temperature, rainfall, count: rows.length };
  }, [rows]);

  const cards: KpiCardSpec[] = [
    {
      label: 'Overall Accuracy',
      subtitle: `Blended · ${kpis.count} district-day${kpis.count === 1 ? '' : 's'}`,
      pct: kpis.overall,
      icon: <TrackChangesRoundedIcon />,
    },
    {
      label: 'Temperature',
      subtitle: 'Max + min, blended',
      pct: kpis.temperature,
      icon: <ThermostatRoundedIcon />,
    },
    {
      label: 'Rainfall',
      subtitle: 'Forecast vs. actual',
      pct: kpis.rainfall,
      icon: <WaterDropRoundedIcon />,
    },
  ];

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      {cards.map((c) => (
        <KpiCard key={c.label} {...c} />
      ))}
    </Stack>
  );
}
