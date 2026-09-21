import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ThermostatRoundedIcon from '@mui/icons-material/ThermostatRounded';
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import AirRoundedIcon from '@mui/icons-material/AirRounded';
import CompressRoundedIcon from '@mui/icons-material/CompressRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { ChartCard } from '@/components/common/ChartCard';
import { SiteStatusChip } from '@/components/common/StatusChip';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { LineAreaChart } from '@/components/charts/LineAreaChart';
import { ForecastStrip } from '@/components/weather/ForecastStrip';
import { useGetSiteDetailQuery } from '@/features/sites/sitesApi';
import { useGetCurrentObservationBySiteQuery, useGetForecastQuery, useGetHistoricalDataQuery } from '@/features/weather/weatherApi';
import { formatDate, formatDateTime, formatWithUnit } from '@/utils/formatters';
import { ROUTES } from '@/routes/routePaths';

export default function SiteDetailPage() {
  const { siteId = '' } = useParams();
  const navigate = useNavigate();

  const { data: site, isLoading: siteLoading, isError: siteError, refetch: refetchSite } = useGetSiteDetailQuery(siteId);
  const { data: obs, isLoading: obsLoading } = useGetCurrentObservationBySiteQuery(siteId, { pollingInterval: 60000 });
  const { data: forecast } = useGetForecastQuery({ siteId, days: 7 });
  const { data: history } = useGetHistoricalDataQuery({
    siteId,
    from: dayjs().subtract(24, 'hour').toISOString(),
    to: dayjs().toISOString(),
    interval: 'hourly',
  });

  if (siteLoading) return <LoadingState label="Loading site details..." />;
  if (siteError || !site) return <ErrorState title="Site not found" onRetry={refetchSite} />;

  return (
    <Stack spacing={3}>
      <PageHeader
        title={site.name}
        description={site.address}
        crumbs={[{ label: 'Sites', to: ROUTES.sites }, { label: site.name }]}
        actions={
          <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate(ROUTES.sites)} size="small">
            Back to sites
          </Button>
        }
      />

      <Grid container spacing={2}>
        <Grid item xs={12} lg={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle1" fontWeight={700}>
                  Site Information
                </Typography>
                <SiteStatusChip status={site.status} />
              </Stack>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={1.25}>
                <InfoRow label="Site Code" value={site.code} />
                <InfoRow label="Circle" value={site.circle} />
                <InfoRow label="State" value={site.state} />
                <InfoRow label="Tower Type" value={site.towerType} />
                <InfoRow label="Elevation" value={`${site.elevationMeters} m`} />
                <InfoRow label="Coordinates" value={`${site.latitude.toFixed(4)}, ${site.longitude.toFixed(4)}`} />
                <InfoRow label="Installed On" value={formatDate(site.installedOn)} />
                <InfoRow label="Contact Person" value={site.contactPerson} />
                <InfoRow label="Contact Phone" value={site.contactPhone} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={8}>
          <Grid container spacing={2} sx={{ height: '100%' }}>
            {obsLoading || !obs ? (
              <Grid item xs={12}>
                <LoadingState label="Loading current weather..." />
              </Grid>
            ) : (
              <>
                <Grid item xs={6} sm={4}>
                  <StatCard label="Temperature" value={formatWithUnit(obs.temperature, '°C')} icon={<ThermostatRoundedIcon />} color="#d97706" subtitle={`Feels like ${obs.feelsLike}°C`} />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <StatCard label="Rainfall (1hr)" value={formatWithUnit(obs.rainfallLastHour, 'mm')} icon={<WaterDropRoundedIcon />} color="#0284c7" subtitle={`${obs.rainfallToday} mm today`} />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <StatCard label="Wind Speed" value={formatWithUnit(obs.windSpeed, 'km/h')} icon={<AirRoundedIcon />} color="#0ea5a4" subtitle={`Gusting ${obs.windGust} km/h`} />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <StatCard label="Humidity" value={`${obs.humidity}%`} icon={<WaterDropRoundedIcon />} color="#2563eb" subtitle={`Visibility ${obs.visibilityKm} km`} />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <StatCard label="Pressure" value={formatWithUnit(obs.pressure, 'hPa', 0)} icon={<CompressRoundedIcon />} color="#7c3aed" />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <StatCard label="Lightning (1hr)" value={obs.lightningStrikesLastHour} icon={<BoltRoundedIcon />} color="#dc2626" subtitle="strikes nearby" />
                </Grid>
              </>
            )}
          </Grid>
        </Grid>
      </Grid>

      <ChartCard title="Last 24 Hours" subtitle={obs ? `As of ${formatDateTime(obs.timestamp)}` : undefined} height={300}>
        {history && history.length > 0 ? (
          <LineAreaChart
            categories={history.map((p) => dayjs(p.timestamp).format('HH:mm'))}
            series={[
              { name: 'Temperature (°C)', data: history.map((p) => p.temperature) },
              { name: 'Rainfall (mm)', data: history.map((p) => p.rainfall) },
            ]}
            height={280}
          />
        ) : (
          <LoadingState label="Loading trend..." />
        )}
      </ChartCard>

      <ChartCard title="7-Day Forecast" subtitle="Outlook for this site">
        {forecast ? <ForecastStrip days={forecast} /> : <LoadingState label="Loading forecast..." />}
      </ChartCard>
    </Stack>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        {value}
      </Typography>
    </Stack>
  );
}
