import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ViewModuleRoundedIcon from '@mui/icons-material/ViewModuleRounded';
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/FilterBar';
import { LoadingState, CardSkeleton } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { WeatherCard } from '@/components/weather/WeatherCard';
import { WeatherIcon, CONDITION_LABEL } from '@/components/weather/weatherIcons';
import { NotAvailable } from '@/components/common/NotAvailable';
import { useListCirclesQuery, useListSitesQuery } from '@/features/sites/sitesApi';
import { useGetCurrentObservationsQuery } from '@/features/weather/weatherApi';
import type { Site } from '@/features/sites/types';
import type { CurrentObservation } from '@/features/weather/types';
import { formatRelative } from '@/utils/formatters';
import { hasRealReading } from '@/utils/dataAvailability';
import { ROUTES } from '@/routes/routePaths';

type ViewMode = 'grid' | 'table';

interface Row {
  site: Site;
  observation: CurrentObservation;
}

export default function WeatherObservationsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [circle, setCircle] = useState('');
  const [view, setView] = useState<ViewMode>('grid');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: circles } = useListCirclesQuery();
  const { data: sitesPage, isLoading: sitesLoading } = useListSitesQuery({
    search: search || undefined,
    circle: circle || undefined,
    pageSize: 500,
  });
  const siteIds = useMemo(() => (sitesPage?.items ?? []).map((s) => s.id), [sitesPage]);
  const {
    data: observations,
    isLoading: obsLoading,
    isError,
    refetch,
  } = useGetCurrentObservationsQuery(siteIds, { skip: siteIds.length === 0, pollingInterval: 60000 });

  const rows: Row[] = useMemo(() => {
    if (!sitesPage || !observations) return [];
    const obsMap = new Map(observations.map((o) => [o.siteId, o]));
    return sitesPage.items
      .map((site) => ({ site, observation: obsMap.get(site.id) }))
      .filter((r): r is Row => Boolean(r.observation));
  }, [sitesPage, observations]);

  const isLoading = sitesLoading || obsLoading;

  const columns: ColumnDef<Row>[] = [
    { key: 'name', header: 'Site', render: (r) => r.site.name },
    { key: 'circle', header: 'Circle', render: (r) => r.site.circle },
    {
      key: 'condition',
      header: 'Condition',
      render: (r) =>
        hasRealReading(r.observation) ? (
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <WeatherIcon condition={r.observation.condition} sx={{ fontSize: 20 }} />
            <span>{CONDITION_LABEL[r.observation.condition]}</span>
          </Stack>
        ) : (
          <NotAvailable inline reason="No ingested hourly_weather rows for this tower yet" />
        ),
    },
    {
      key: 'temperature',
      header: 'Temp (°C)',
      align: 'right',
      render: (r) => (hasRealReading(r.observation) ? r.observation.temperature : <NotAvailable inline />),
    },
    {
      key: 'humidity',
      header: 'Humidity (%)',
      align: 'right',
      render: (r) => (hasRealReading(r.observation) ? r.observation.humidity : <NotAvailable inline />),
    },
    {
      key: 'windSpeed',
      header: 'Wind (km/h)',
      align: 'right',
      render: (r) => (hasRealReading(r.observation) ? r.observation.windSpeed : <NotAvailable inline />),
    },
    {
      key: 'rainfallLastHour',
      header: 'Rainfall 1h (mm)',
      align: 'right',
      render: (r) => (hasRealReading(r.observation) ? r.observation.rainfallLastHour : <NotAvailable inline />),
    },
    {
      key: 'pressure',
      header: 'Pressure (hPa, est.)',
      align: 'right',
      render: (r) => (hasRealReading(r.observation) ? r.observation.pressure : <NotAvailable inline />),
    },
    {
      key: 'updated',
      header: 'Updated',
      render: (r) => (hasRealReading(r.observation) ? formatRelative(r.observation.timestamp) : <NotAvailable inline />),
    },
  ];

  const pagedRows = rows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

  return (
    <Stack spacing={2}>
      <PageHeader title="Weather Observations" description="Live current conditions across all monitored sites" />

      <FilterBar>
        <TextField
          size="small"
          placeholder="Search sites..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 240 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <TextField select size="small" label="Circle" value={circle} onChange={(e) => setCircle(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">All circles</MenuItem>
          {circles?.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </TextField>
        <ToggleButtonGroup
          size="small"
          value={view}
          exclusive
          onChange={(_e, v) => v && setView(v)}
          sx={{ ml: 'auto' }}
        >
          <ToggleButton value="grid">
            <ViewModuleRoundedIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="table">
            <ViewListRoundedIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
      </FilterBar>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : isLoading ? (
        view === 'grid' ? (
          <Grid container spacing={2}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={i}>
                <CardSkeleton height={200} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <LoadingState label="Loading observations..." />
        )
      ) : rows.length === 0 ? (
        <EmptyState title="No observations found" message="Try adjusting your search or circle filter." />
      ) : view === 'grid' ? (
        <>
          <Grid container spacing={2}>
            {rows.map((row) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={row.site.id}>
                <WeatherCard site={row.site} observation={row.observation} onClick={() => navigate(ROUTES.siteDetail(row.site.id))} />
              </Grid>
            ))}
          </Grid>
        </>
      ) : (
        <DataTable
          columns={columns}
          rows={pagedRows}
          getRowId={(r) => r.site.id}
          total={rows.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          onRowClick={(r) => navigate(ROUTES.siteDetail(r.site.id))}
        />
      )}
    </Stack>
  );
}
