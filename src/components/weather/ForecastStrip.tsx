import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import dayjs from 'dayjs';
import { WeatherIcon, CONDITION_LABEL } from './weatherIcons';
import type { ForecastDay } from '@/features/weather/types';

export function ForecastStrip({ days }: { days: ForecastDay[] }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ overflowX: 'auto', pb: 1 }}>
      {days.map((day, index) => (
        <Paper
          key={day.date}
          variant="outlined"
          sx={{ p: 2, minWidth: 140, textAlign: 'center', flexShrink: 0 }}
        >
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            {index === 0 ? 'Today' : dayjs(day.date).format('ddd, DD MMM')}
          </Typography>
          <Stack alignItems="center" sx={{ my: 1 }}>
            <WeatherIcon condition={day.condition} sx={{ fontSize: 34 }} />
          </Stack>
          <Typography variant="body2" fontWeight={700}>
            {day.maxTemp}° / {day.minTemp}°
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            {CONDITION_LABEL[day.condition]}
          </Typography>
          <Typography variant="caption" color="primary" fontWeight={600}>
            {day.rainfallProbability}% rain
          </Typography>
        </Paper>
      ))}
    </Stack>
  );
}
