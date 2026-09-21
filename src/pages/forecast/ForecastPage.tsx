import { useState } from 'react';
import dayjs from 'dayjs';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/FilterBar';
import { ChartCard } from '@/components/common/ChartCard';
import { SiteSelector } from '@/components/common/SiteSelector';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { ForecastStrip } from '@/components/weather/ForecastStrip';
import { LineAreaChart } from '@/components/charts/LineAreaChart';
import { BarChart } from '@/components/charts/BarChart';
import { useGetForecastQuery } from '@/features/weather/weatherApi';

export default function ForecastPage() {
  // No default site - 'site-1' was a demo-mode id with no counterpart among
  // real Indus towers (real ids are the numeric `locations.id` primary
  // key), so starts unselected and shows the "Select a site" state below.
  const [siteId, setSiteId] = useState<string | null>(null);
  const [days, setDays] = useState(7);

  const { data, isLoading, isError, refetch } = useGetForecastQuery(siteId ? { siteId, days } : ({} as never), {
    skip: !siteId,
  });

  return (
    <Stack spacing={2}>
      <PageHeader title="Forecast" description="Multi-day weather outlook per site" />

      <FilterBar>
        <SiteSelector value={siteId} onChange={setSiteId} />
        <TextField select size="small" label="Days" value={days} onChange={(e) => setDays(Number(e.target.value))} sx={{ minWidth: 120 }}>
          {[3, 5, 7, 10].map((d) => (
            <MenuItem key={d} value={d}>
              {d} days
            </MenuItem>
          ))}
        </TextField>
      </FilterBar>

      {!siteId ? (
        <EmptyState title="Select a site" message="Choose a site above to view its forecast." />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : isLoading || !data ? (
        <LoadingState label="Loading forecast..." />
      ) : data.length === 0 ? (
        // The backend skips any day it has no ingested hourly_weather rows
        // for rather than fabricating one (see IndusWeatherService.forecast) -
        // an empty result means this tower's forecast pipeline hasn't reached
        // any of the requested days yet, not an error.
        <EmptyState
          title="Not currently available"
          message="No forecast data has been ingested yet for this site's selected date range. Try a shorter range or check back once ingestion catches up."
        />
      ) : (
        <>
          <ChartCard title={`${days}-Day Outlook`}>
            <ForecastStrip days={data} />
          </ChartCard>

          <Grid container spacing={2}>
            <Grid item xs={12} lg={7}>
              <ChartCard title="Temperature Range" subtitle="Daily min / max" height={320}>
                <LineAreaChart
                  categories={data.map((d) => dayjs(d.date).format('DD MMM'))}
                  series={[
                    { name: 'Max Temp (°C)', data: data.map((d) => d.maxTemp) },
                    { name: 'Min Temp (°C)', data: data.map((d) => d.minTemp) },
                  ]}
                  type="line"
                  height={300}
                />
              </ChartCard>
            </Grid>
            <Grid item xs={12} lg={5}>
              <ChartCard title="Rainfall Probability" subtitle="Chance of rain per day" height={320}>
                <BarChart
                  categories={data.map((d) => dayjs(d.date).format('DD MMM'))}
                  series={[{ name: 'Rain Probability (%)', data: data.map((d) => d.rainfallProbability) }]}
                  height={300}
                  colors={['#0284c7']}
                />
              </ChartCard>
            </Grid>
          </Grid>
        </>
      )}
    </Stack>
  );
}
