import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

interface StatBoxProps {
  icon: JSX.Element;
  label: string;
  value: string;
  subtitle?: string;
}

/** Small bordered stat tile shared by the per-tower and network-wide
 *  "Weather details" panels (WeatherDetailsPanel / NetworkWeatherPanel). */
export function StatBox({ icon, label, value, subtitle }: StatBoxProps) {
  return (
    <Box sx={{ flex: 1, p: 1.25, borderRadius: 1.5, border: '1px solid', borderColor: 'divider', minWidth: 0 }}>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: 'text.secondary', mb: 0.5 }}>
        {icon}
        <Typography variant="caption" fontWeight={700} sx={{ letterSpacing: 0.3 }}>
          {label}
        </Typography>
      </Stack>
      <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }} noWrap>
        {value}
      </Typography>
      {subtitle && (
        <Typography variant="caption" color="text.secondary" noWrap>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}
