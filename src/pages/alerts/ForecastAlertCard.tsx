import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import ThermostatRoundedIcon from '@mui/icons-material/ThermostatRounded';
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import AirRoundedIcon from '@mui/icons-material/AirRounded';
import { SeverityChip } from '@/components/common/StatusChip';
import { severityColors } from '@/theme/theme';
import { formatDate, formatWithUnit } from '@/utils/formatters';
import type { ForecastAlertItem } from '@/features/alerts/types';

const PARAMETER_ICON: Record<ForecastAlertItem['parameter'], JSX.Element> = {
  temperature: <ThermostatRoundedIcon fontSize="small" />,
  rainfall: <WaterDropRoundedIcon fontSize="small" />,
  windSpeed: <AirRoundedIcon fontSize="small" />,
};

/** "Today" / "Tomorrow" / "In N days" - friendlier than a bare day count for
 *  a forecast that's meant to give a team lead time to prepare. */
function daysAheadLabel(daysAhead: number): string {
  if (daysAhead === 0) return 'Today';
  if (daysAhead === 1) return 'Tomorrow';
  return `In ${daysAhead} days`;
}

interface ForecastAlertCardProps {
  alert: ForecastAlertItem;
}

export function ForecastAlertCard({ alert }: ForecastAlertCardProps) {
  return (
    <Card variant="outlined" sx={{ borderLeft: '5px solid', borderLeftColor: severityColors[alert.severity] }}>
      <CardContent>
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={12} sm="auto">
            <Stack direction="row" spacing={1} alignItems="center">
              {PARAMETER_ICON[alert.parameter]}
              <SeverityChip severity={alert.severity} />
            </Stack>
          </Grid>
          <Grid item xs>
            <Typography variant="subtitle2" fontWeight={700}>
              {alert.message}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {alert.siteName}, {alert.state} · Predicted {formatWithUnit(alert.predictedValue, alert.unit)} (band starts at{' '}
              {formatWithUnit(alert.thresholdValue, alert.unit, 0)})
            </Typography>
          </Grid>
          <Grid item xs={12} sm="auto">
            <Stack spacing={0.25} alignItems={{ xs: 'flex-start', sm: 'flex-end' }}>
              <Typography variant="caption" fontWeight={700}>
                {daysAheadLabel(alert.daysAhead)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDate(alert.date)}
              </Typography>
            </Stack>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}
