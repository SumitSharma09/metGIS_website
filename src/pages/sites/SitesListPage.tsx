import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/FilterBar';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { SiteStatusChip } from '@/components/common/StatusChip';
import { ErrorState } from '@/components/common/ErrorState';
import { useListCirclesQuery, useListSitesQuery } from '@/features/sites/sitesApi';
import type { Site } from '@/features/sites/types';
import { formatDate } from '@/utils/formatters';
import { ROUTES } from '@/routes/routePaths';
import type { SiteStatus } from '@/utils/constants';

const STATUS_OPTIONS: SiteStatus[] = ['active', 'maintenance', 'inactive'];

export default function SitesListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [circle, setCircle] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<string | undefined>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data: circles } = useListCirclesQuery();
  const { data, isLoading, isFetching, isError, refetch } = useListSitesQuery({
    search: search || undefined,
    circle: circle || undefined,
    status: (status as SiteStatus) || undefined,
    page,
    pageSize,
    sortBy,
    sortDir,
  });

  const columns: ColumnDef<Site>[] = useMemo(
    () => [
      { key: 'code', header: 'Code', sortable: true },
      { key: 'name', header: 'Site Name', sortable: true },
      { key: 'circle', header: 'Circle', sortable: true },
      { key: 'state', header: 'State' },
      { key: 'towerType', header: 'Tower Type' },
      {
        key: 'status',
        header: 'Status',
        render: (row) => <SiteStatusChip status={row.status} />,
      },
      {
        key: 'installedOn',
        header: 'Installed On',
        sortable: true,
        render: (row) => formatDate(row.installedOn),
      },
    ],
    []
  );

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Sites"
        description="Monitored infrastructure sites and their current status"
        actions={
          <Button startIcon={<RefreshRoundedIcon />} onClick={() => refetch()} variant="outlined" size="small">
            Refresh
          </Button>
        }
      />

      <FilterBar>
        <TextField
          size="small"
          placeholder="Search by name, code, state..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          sx={{ minWidth: 260 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          select
          size="small"
          label="Circle"
          value={circle}
          onChange={(e) => {
            setCircle(e.target.value);
            setPage(1);
          }}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">All circles</MenuItem>
          {circles?.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">All statuses</MenuItem>
          {STATUS_OPTIONS.map((s) => (
            <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>
              {s}
            </MenuItem>
          ))}
        </TextField>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          {data ? `${data.total} sites found` : ''}
        </Typography>
      </FilterBar>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          getRowId={(row) => row.id}
          total={data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={(key, dir) => {
            setSortBy(key);
            setSortDir(dir);
          }}
          loading={isLoading || isFetching}
          emptyMessage="No sites match the selected filters."
          onRowClick={(row) => navigate(ROUTES.siteDetail(row.id))}
        />
      )}
    </Stack>
  );
}
