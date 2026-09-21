import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/FilterBar';
import { ChartCard } from '@/components/common/ChartCard';
import { SiteSelector } from '@/components/common/SiteSelector';
import { DateRangeSelector } from '@/components/common/DateRangeSelector';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { LineAreaChart } from '@/components/charts/LineAreaChart';
import { useGetHistoricalDataQuery } from '@/features/weather/weatherApi';
import { WEATHER_PARAMETERS, type WeatherParameter } from '@/utils/constants';
import { formatDateTime } from '@/utils/formatters';
import type { HistoricalPoint } from '@/features/weather/types';

const PLOTTABLE_PARAMS: WeatherParameter[] = ['temperature', 'rainfall', 'windSpeed', 'humidity', 'pressure'];

export default function HistoricalDataPage() {
  // No default site - 'site-1' was a demo-mode id that doesn't exist among
  // real Indus towers (real ids are the numeric `locations.id` primary key),
  // so defaulting to it silently requested data for a site that was never
  // there once real data replaced the demo dataset. Starting unselected
  // shows the existing "Select a site" EmptyState below instead.
  const [siteId, setSiteId] = useState<string | null>(null);
  const [range, setRange] = useState({ from: dayjs().subtract(7, 'day').format('YYYY-MM-DD'), to: dayjs().format('YYYY-MM-DD') });
  const [interval, setInterval_] = useState<'hourly' | 'daily'>('daily');
  const [selectedParams, setSelectedParams] = useState<WeatherParameter[]>(['temperature', 'rainfall']);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading, isError, refetch } = useGetHistoricalDataQuery(
    siteId
      ? {
          siteId,
          from: dayjs(range.from).startOf('day').toISOString(),
          to: dayjs(range.to).endOf('day').toISOString(),
          interval,
        }
      : ({} as never),
    { skip: !siteId }
  );

  const toggleParam = (param: WeatherParameter) => {
    setSelectedParams((prev) => (prev.includes(param) ? prev.filter((p) => p !== param) : [...prev, param]));
  };

  const series = useMemo(() => {
    if (!data) return [];
    return selectedParams.map((param) => ({
      name: WEATHER_PARAMETERS.find((p) => p.value === param)?.label ?? param,
      data: data.map((point) => Number((point as unknown as Record<string, number>)[param] ?? 0)),
    }));
  }, [data, selectedParams]);

  const categories = useMemo(
    () => (data ?? []).map((p) => dayjs(p.timestamp).format(interval === 'hourly' ? 'DD MMM HH:mm' : 'DD MMM')),
    [data, interval]
  );

  const columns: ColumnDef<HistoricalPoint>[] = [
    { key: 'timestamp', header: 'Timestamp', render: (r) => formatDateTime(r.timestamp) },
    { key: 'temperature', header: 'Temp (°C)', align: 'right' },
    { key: 'rainfall', header: 'Rainfall (mm)', align: 'right' },
    { key: 'windSpeed', header: 'Wind (km/h)', align: 'right' },
    { key: 'humidity', header: 'Humidity (%)', align: 'right' },
    // Pressure has no real source column (see IndusWeatherMapper.derivePressure) -
    // labeled "est." so the table doesn't present a modeled value as measured.
    { key: 'pressure', header: 'Pressure (hPa, est.)', align: 'right' },
  ];

  const pagedRows = (data ?? []).slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

  const handleExportCsv = () => {
    if (!data || data.length === 0) return;
    const header = ['timestamp', 'temperature', 'rainfall', 'windSpeed', 'humidity', 'pressure', 'lightningStrikes'];
    const csvRows = [header.join(',')].concat(
      data.map((p) => header.map((key) => String((p as unknown as Record<string, unknown>)[key] ?? '')).join(','))
    );
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historical-${siteId}-${range.from}-to-${range.to}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Stack spacing={2}>
      <PageHeader title="Historical Data" description="Explore past weather readings for any site and date range" />

      <FilterBar>
        <SiteSelector value={siteId} onChange={setSiteId} />
        <DateRangeSelector from={range.from} to={range.to} onChange={setRange} />
        <TextField select size="small" label="Interval" value={interval} onChange={(e) => setInterval_(e.target.value as 'hourly' | 'daily')} sx={{ minWidth: 140 }}>
          <MenuItem value="daily">Daily</MenuItem>
          <MenuItem value="hourly">Hourly</MenuItem>
        </TextField>
        <Button startIcon={<DownloadRoundedIcon />} size="small" variant="outlined" onClick={handleExportCsv} disabled={!data || data.length === 0} sx={{ ml: 'auto' }}>
          Export CSV
        </Button>
      </FilterBar>

      <Stack direction="row" spacing={1} flexWrap="wrap">
        {PLOTTABLE_PARAMS.map((param) => {
          const meta = WEATHER_PARAMETERS.find((p) => p.value === param)!;
          const active = selectedParams.includes(param);
          return (
            <Chip
              key={param}
              label={meta.label}
              onClick={() => toggleParam(param)}
              color={active ? 'primary' : 'default'}
              variant={active ? 'filled' : 'outlined'}
              size="small"
            />
          );
        })}
      </Stack>

      {!siteId ? (
        <EmptyState title="Select a site" message="Choose a site above to view its historical weather data." />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : isLoading ? (
        <LoadingState label="Loading historical data..." />
      ) : !data || data.length === 0 ? (
        <EmptyState title="No data for this range" message="Try a different date range or interval." />
      ) : (
        <>
          <ChartCard title="Trend" subtitle={`${range.from} to ${range.to} · ${interval}`} height={340}>
            {series.length === 0 ? (
              <EmptyState message="Select at least one parameter to plot." />
            ) : (
              <LineAreaChart categories={categories} series={series} height={320} type="line" />
            )}
          </ChartCard>

          <DataTable
            columns={columns}
            rows={pagedRows}
            getRowId={(r) => r.timestamp}
            total={data.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </>
      )}
    </Stack>
  );
}
