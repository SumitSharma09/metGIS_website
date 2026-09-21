import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import ThermostatRoundedIcon from '@mui/icons-material/ThermostatRounded';
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { ChartCard } from '@/components/common/ChartCard';
import { LoadingState, CardSkeleton } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { SeverityChip } from '@/components/common/StatusChip';
import { BarChart } from '@/components/charts/BarChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { useGetDashboardStatsQuery } from '@/features/dashboard/dashboardApi';
import { formatRelative } from '@/utils/formatters';
import { severityColors } from '@/theme/theme';
import { ROUTES } from '@/routes/routePaths';

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useGetDashboardStatsQuery();
  const navigate = useNavigate();

  if (isLoading) return <LoadingState label="Loading dashboard..." />;
  if (isError || !data) return <ErrorState onRetry={refetch} />;

  const severityEntries = Object.entries(data.activeAlertsBySeverity).filter(([, count]) => count > 0);

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Dashboard"
        description="Live weather overview across all monitored infrastructure sites"
      />

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            label="Total Sites"
            value={data.totalSites}
            icon={<LocationOnRoundedIcon />}
            color="#2563eb"
            subtitle={`${data.activeSites} active · ${data.sitesInMaintenance} in maintenance`}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            label="Active Alerts"
            value={severityEntries.reduce((sum, [, c]) => sum + c, 0)}
            icon={<NotificationsActiveRoundedIcon />}
            color="#dc2626"
            subtitle={`${data.activeAlertsBySeverity.critical} critical · ${data.activeAlertsBySeverity.high} high`}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            label="Avg. Temperature"
            value={`${data.avgTemperature}°C`}
            icon={<ThermostatRoundedIcon />}
            color="#d97706"
            subtitle="Across all active sites"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            label="Rainfall Today"
            value={`${data.totalRainfallTodayMm.toFixed(0)} mm`}
            icon={<WaterDropRoundedIcon />}
            color="#0ea5a4"
            subtitle={`${data.sitesWithLightningRisk} sites with lightning risk`}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={7}>
          <ChartCard title="Average Temperature by Circle" subtitle="Current reading, grouped by region" height={320}>
            <BarChart
              categories={data.circleSummary.map((c) => c.circle)}
              series={[{ name: 'Avg Temp (°C)', data: data.circleSummary.map((c) => c.avgTemperature) }]}
              height={300}
            />
          </ChartCard>
        </Grid>
        <Grid item xs={12} lg={5}>
          <ChartCard title="Active Alerts by Severity" subtitle="Currently unresolved" height={320}>
            {severityEntries.length === 0 ? (
              <EmptyState title="No active alerts" message="All monitored sites are within normal thresholds." />
            ) : (
              <DonutChart
                labels={severityEntries.map(([s]) => s)}
                series={severityEntries.map(([, c]) => c)}
                colors={severityEntries.map(([s]) => severityColors[s])}
                height={280}
              />
            )}
          </ChartCard>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={7}>
          <ChartCard title="Top Rainfall Sites (Today)" subtitle="Highest recorded rainfall">
            {data.topRainfallSites.length === 0 ? (
              <EmptyState message="No rainfall recorded today." />
            ) : (
              <BarChart
                categories={data.topRainfallSites.map((s) => s.siteName)}
                series={[{ name: 'Rainfall (mm)', data: data.topRainfallSites.map((s) => s.rainfallMm) }]}
                horizontal
                colors={['#0ea5a4']}
              />
            )}
          </ChartCard>
        </Grid>
        <Grid item xs={12} lg={5}>
          <ChartCard title="Recent Alerts" subtitle="Latest triggered across all sites">
            {data.recentAlerts.length === 0 ? (
              <EmptyState message="No recent alerts." />
            ) : (
              <List disablePadding>
                {data.recentAlerts.map((alert) => (
                  <ListItem
                    key={alert.id}
                    divider
                    sx={{ px: 0, cursor: 'pointer' }}
                    onClick={() => navigate(ROUTES.alerts)}
                    secondaryAction={<SeverityChip severity={alert.severity} />}
                  >
                    <ListItemText
                      primary={alert.message}
                      secondary={
                        <Stack direction="row" spacing={1} alignItems="center" component="span">
                          <Typography variant="caption" color="text.secondary" component="span">
                            {alert.siteName}
                          </Typography>
                          <Chip size="small" label={formatRelative(alert.triggeredAt)} variant="outlined" sx={{ height: 18, fontSize: 11 }} />
                        </Stack>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </ChartCard>
        </Grid>
      </Grid>
    </Stack>
  );
}

export function DashboardSkeleton() {
  return (
    <Grid container spacing={2}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Grid item xs={12} sm={6} lg={3} key={i}>
          <CardSkeleton height={110} />
        </Grid>
      ))}
    </Grid>
  );
}
