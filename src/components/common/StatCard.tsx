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
  /** Compact rendering - smaller padding/icon/type scale, an uppercase
   *  letter-spaced label instead of the plain body2 one - added 2026-09-24
   *  per an explicit request to shrink the Comparison page's 5-tile KPI row
   *  ("decrease the size of ... make a professional way"), where the
   *  default tile size (built for a 3-4 tile dashboard row) left the row
   *  feeling oversized. Defaults to `false` so every other page using this
   *  card (Dashboard, Site Detail, NotAvailable) renders exactly as before -
   *  this is opt-in, not a global size change. */
  dense?: boolean;
}

export function StatCard({ label, value, icon, color = '#2563eb', trend, subtitle, dense = false }: StatCardProps) {
  const trendUp = (trend?.value ?? 0) >= 0;
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={dense ? { p: 1.75, '&:last-child': { pb: 1.75 } } : undefined}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={700}
              noWrap
              sx={
                dense
                  ? { display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.68rem' }
                  : { display: 'block' }
              }
            >
              {label}
            </Typography>
            <Typography
              variant={dense ? 'h6' : 'h4'}
              fontWeight={700}
              noWrap
              sx={{ mt: dense ? 0.25 : 0.5, lineHeight: dense ? 1.2 : undefined }}
            >
              {value}
            </Typography>
            {subtitle && (
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                sx={{ display: 'block', fontSize: dense ? '0.68rem' : undefined }}
              >
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
              width: dense ? 32 : 44,
              height: dense ? 32 : 44,
              borderRadius: dense ? 2 : 2.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: `${color}1a`,
              color,
              flexShrink: 0,
              '& svg': dense ? { fontSize: 18 } : undefined,
            }}
          >
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
