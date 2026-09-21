import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import ThermostatRoundedIcon from '@mui/icons-material/ThermostatRounded';
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import AirRoundedIcon from '@mui/icons-material/AirRounded';
import { formatDateTime, formatRelative } from '@/utils/formatters';
import type { DeviationAlert, DeviationSeverity } from '@/features/deviations/types';

const SEVERITY_COLOR: Record<DeviationSeverity, string> = {
  minor: '#65a30d',
  moderate: '#d97706',
  major: '#dc2626',
};

const PARAMETER_ICON: Record<DeviationAlert['parameter'], JSX.Element> = {
  temperature: <ThermostatRoundedIcon fontSize="small" />,
  rainfall: <WaterDropRoundedIcon fontSize="small" />,
  windSpeed: <AirRoundedIcon fontSize="small" />,
};

interface DeviationAlertCardProps {
  deviation: DeviationAlert;
  onAcknowledge: () => void;
}

export function DeviationAlertCard({ deviation, onAcknowledge }: DeviationAlertCardProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderLeft: '5px solid',
        borderLeftColor: SEVERITY_COLOR[deviation.severity],
        opacity: deviation.acknowledged ? 0.75 : 1,
      }}
    >
      <CardActionArea onClick={onAcknowledge} disabled={deviation.acknowledged}>
        <CardContent>
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={12} sm="auto">
              <Stack direction="row" spacing={1} alignItems="center">
                {PARAMETER_ICON[deviation.parameter]}
                <Chip
                  size="small"
                  label={deviation.severity.toUpperCase()}
                  sx={{ backgroundColor: SEVERITY_COLOR[deviation.severity], color: '#fff', fontWeight: 700 }}
                />
                {deviation.acknowledged && <Chip size="small" variant="outlined" label="Acknowledged" />}
              </Stack>
            </Grid>
            <Grid item xs>
              <Typography variant="subtitle2" fontWeight={700}>
                {deviation.message}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {deviation.siteName} · Forecast for {deviation.forecastDate} · run {deviation.previousIssuedDate} → {deviation.updatedIssuedDate}
              </Typography>
            </Grid>
            <Grid item xs={12} sm="auto">
              <Stack spacing={0.25} alignItems={{ xs: 'flex-start', sm: 'flex-end' }}>
                <Typography variant="caption" color="text.secondary">
                  Detected: {formatDateTime(deviation.detectedAt)} ({formatRelative(deviation.detectedAt)})
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Δ {deviation.deltaAbsolute}
                </Typography>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
