import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  color?: string;
  trend?: { value: number; label?: string };
  subtitle?: string;
}

export function StatCard({ label, value, icon, color = '#2563eb', trend, subtitle }: StatCardProps) {
  const trendUp = (trend?.value ?? 0) >= 0;
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              {label}
            </Typography>
            <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5 }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
            {trend && (
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 1 }}>
                {trendUp ? (
                  <ArrowUpwardRoundedIcon sx={{ fontSize: 16, color: 'success.main' }} />
                ) : (
                  <ArrowDownwardRoundedIcon sx={{ fontSize: 16, color: 'error.main' }} />
                )}
                <Typography variant="caption" color={trendUp ? 'success.main' : 'error.main'} fontWeight={600}>
                  {Math.abs(trend.value)}%
                </Typography>
                {trend.label && (
                  <Typography variant="caption" color="text.secondary">
                    {trend.label}
                  </Typography>
                )}
              </Stack>
            )}
          </Box>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: `${color}1a`,
              color,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
