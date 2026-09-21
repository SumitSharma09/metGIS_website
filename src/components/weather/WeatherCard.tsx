import type { ReactNode } from 'react';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import ThermostatRoundedIcon from '@mui/icons-material/ThermostatRounded';
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import AirRoundedIcon from '@mui/icons-material/AirRounded';
import { WeatherIcon, CONDITION_LABEL } from './weatherIcons';
import type { Site } from '@/features/sites/types';
import type { CurrentObservation } from '@/features/weather/types';
import { formatRelative } from '@/utils/formatters';
import { hasRealReading } from '@/utils/dataAvailability';
import { NotAvailable } from '@/components/common/NotAvailable';

interface WeatherCardProps {
  site: Site;
  observation: CurrentObservation;
  onClick?: () => void;
}

export function WeatherCard({ site, observation, onClick }: WeatherCardProps) {
  const live = hasRealReading(observation);
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardActionArea onClick={onClick} sx={{ height: '100%' }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Stack>
              <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ maxWidth: 180 }}>
                {site.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {site.circle} · {site.code}
              </Typography>
            </Stack>
            {live && <WeatherIcon condition={observation.condition} sx={{ fontSize: 32 }} />}
          </Stack>

          {live ? (
            <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ mt: 1.5 }}>
              <Typography variant="h4" fontWeight={800}>
                {observation.temperature}°
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {CONDITION_LABEL[observation.condition]}
              </Typography>
            </Stack>
          ) : (
            <Stack sx={{ mt: 1.5 }}>
              <NotAvailable reason="This tower has no ingested hourly_weather rows yet" />
            </Stack>
          )}

          <Divider sx={{ my: 1.5 }} />

          {live ? (
            <Grid container spacing={1}>
              <MiniStat icon={<WaterDropRoundedIcon fontSize="inherit" />} label="Rain" value={`${observation.rainfallLastHour} mm`} />
              <MiniStat icon={<AirRoundedIcon fontSize="inherit" />} label="Wind" value={`${observation.windSpeed} km/h`} />
              <MiniStat icon={<ThermostatRoundedIcon fontSize="inherit" />} label="Humidity" value={`${observation.humidity}%`} />
            </Grid>
          ) : (
            <Grid container spacing={1}>
              <MiniStat icon={<WaterDropRoundedIcon fontSize="inherit" />} label="Rain" value="--" />
              <MiniStat icon={<AirRoundedIcon fontSize="inherit" />} label="Wind" value="--" />
              <MiniStat icon={<ThermostatRoundedIcon fontSize="inherit" />} label="Humidity" value="--" />
            </Grid>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
            {live ? `Updated ${formatRelative(observation.timestamp)}` : 'Not yet reporting'}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function MiniStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Grid item xs={4}>
      <Stack alignItems="center" spacing={0.25}>
        <Stack direction="row" alignItems="center" spacing={0.5} color="text.secondary">
          {icon}
          <Typography variant="caption">{label}</Typography>
        </Stack>
        <Typography variant="body2" fontWeight={700}>
          {value}
        </Typography>
      </Stack>
    </Grid>
  );
}
