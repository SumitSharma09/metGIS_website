import { useMemo, useState } from 'react';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/FilterBar';
import { MultiSiteSelector } from '@/components/common/SiteSelector';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { useListSitesQuery } from '@/features/sites/sitesApi';
import { useGetComparisonQuery } from '@/features/comparison/comparisonApi';
import { exportComparisonToExcel } from './comparisonExport';
import { AccuracyKpis } from './components/AccuracyKpis';
import { AccuracyTrendChart } from './components/AccuracyTrendChart';
import { ComparisonGrid } from './components/ComparisonGrid';

const WINDOW_OPTIONS = [
  { value: 5, label: 'Last 5 days' },
  { value: 7, label: 'Last 7 days' },
  { value: 14, label: 'Last 14 days' },
];

export default function ComparisonPage() {
  const [siteIds, setSiteIds] = useState<string[]>([]);
  const [windowDays, setWindowDays] = useState(7);

  const { data: sitesPage, isLoading, isError, refetch } = useListSitesQuery({ pageSize: 200 });
  const allSites = useMemo(() => sitesPage?.items ?? [], [sitesPage]);
  const selectedSites = useMemo(
    () => (siteIds.length > 0 ? allSites.filter((s) => siteIds.includes(s.id)) : allSites.slice(0, 8)),
    [allSites, siteIds]
  );

  const {
    data: rows = [],
    isLoading: rowsLoading,
    isError: rowsError,
    refetch: refetchRows,
  } = useGetComparisonQuery({ sites: selectedSites, days: windowDays }, { skip: selectedSites.length === 0 });

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Forecast vs Actual Comparison"
        description="How closely forecasts matched observed conditions across the tower network"
      />

      <FilterBar>
        <MultiSiteSelector value={siteIds} onChange={setSiteIds} label="Sites (default: first 8)" />
        <TextField select size="small" label="Window" value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))} sx={{ minWidth: 160 }}>
          {WINDOW_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
        <Button size="small" variant="outlined" startIcon={<TableChartRoundedIcon />} disabled={rows.length === 0} onClick={() => exportComparisonToExcel(rows)}>
          Export Excel
        </Button>
      </FilterBar>

      {isError || rowsError ? (
        <ErrorState onRetry={isError ? refetch : refetchRows} />
      ) : isLoading || rowsLoading ? (
        <LoadingState label={isLoading ? 'Loading sites...' : 'Loading comparison data...'} />
      ) : (
        <>
          <AccuracyKpis rows={rows} />
          <AccuracyTrendChart rows={rows} />
          <ComparisonGrid rows={rows} />
        </>
      )}
    </Stack>
  );
}
