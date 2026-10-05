import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import Stack from '@mui/material/Stack';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { useListDistrictsQuery } from '@/features/sites/sitesApi';
import { useScopedStates } from '@/features/users/useScopedStates';
import { useGetDistrictComparisonQuery } from '@/features/comparison/comparisonApi';
import { exportComparisonToExcel, exportComparisonToPdf } from './comparisonExport';
import { AccuracyKpis } from './components/AccuracyKpis';
import { AccuracyTrendChart } from './components/AccuracyTrendChart';
import { ComparisonGrid } from './components/ComparisonGrid';

// Per explicit 2026-09-24 requests ("i comapre only last 2 days data remove
// 3 days and 7 days currenly", then "Last 1 days also add"), the window
// selector only ever offers 1 or 2 days now - the old 1/3/7-day options are
// gone for good, not just hidden.
const WINDOW_OPTIONS = [
  { value: 1, label: 'Last 1 day' },
  { value: 2, label: 'Last 2 days' },
];

/**
 * District-level Forecast vs Actual comparison, limited to the last 1 or 2
 * days, covering max/min temperature and rainfall only, per the user's own
 * explicit scoping requests. Backed by the real
 * `indus_districts_actual_gtsData`/`skymet_save_forecast_data` MySQL tables
 * once `app.indus.enabled=true` (see IndusDistrictComparisonService on the
 * backend); mock mode falls back to a seeded generator (see
 * comparisonData.ts).
 * <p>
 * State/District filters replace the old site multi-selector, since the
 * comparison itself is now computed at district grain (multiple real GTS
 * stations and Skymet locations per district are averaged server-side, not
 * picked one at a time) - same State/District Autocomplete + "Scoped to:"
 * pattern as TowerRiskReportsTab, so a non-admin only ever sees districts in
 * their assigned states/circles.
 */
export default function ComparisonPage() {
  const [state, setState] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState(2);

  const { states, isPanIndia, assignedStates } = useScopedStates();
  const { data: districts = [] } = useListDistrictsQuery(state ?? undefined);

  const {
    data: rows = [],
    isLoading: rowsLoading,
    isError: rowsError,
    refetch: refetchRows,
  } = useGetDistrictComparisonQuery({
    state: state ?? undefined,
    district: district ?? undefined,
    days: windowDays,
  });

  // "Viewing: X · Rows: N" / "Window: start -> end (IST)" context line -
  // added 2026-09-25 to match the reference (page 10 of the user's own
  // "Scope Document for POC - Weather Partner" PDF), which shows this exact
  // scope/window summary above its KPI row. Real dates from the actual rows
  // in view, not the requested windowDays count, so a partial result (fewer
  // real ground-truth days than requested) is reflected honestly rather than
  // assumed.
  const viewingScope = district ?? state ?? (isPanIndia ? 'All districts' : assignedStates.join(', ') || 'Assigned districts');
  const dateRange = useMemo(() => {
    if (rows.length === 0) return null;
    const dates = rows.map((r) => r.date).sort();
    return { min: dates[0], max: dates[dates.length - 1] };
  }, [rows]);

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Forecast vs Actual Comparison"
        description={`How closely forecasts matched observed conditions over the last ${windowDays} day${windowDays > 1 ? 's' : ''}, by district - max temperature, min temperature and rainfall`}
      />

      <FilterBar>
        <Autocomplete
          size="small"
          options={states}
          value={state}
          onChange={(_e, value) => {
            setState(value);
            setDistrict(null);
          }}
          sx={{ minWidth: 200 }}
          renderInput={(params) => <TextField {...params} label="State" />}
        />
        <Autocomplete
          size="small"
          options={districts}
          value={district}
          disabled={districts.length === 0}
          onChange={(_e, value) => setDistrict(value)}
          sx={{ minWidth: 200 }}
          renderInput={(params) => <TextField {...params} label="District" />}
        />
        <TextField
          select
          size="small"
          label="Window"
          value={windowDays}
          onChange={(e) => setWindowDays(Number(e.target.value))}
          sx={{ minWidth: 140 }}
        >
          {WINDOW_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
        {!isPanIndia && (
          <Chip
            size="small"
            variant="outlined"
            color="primary"
            icon={<LockRoundedIcon fontSize="small" />}
            label={`Scoped to: ${assignedStates.join(', ') || 'none assigned'}`}
          />
        )}
        <Divider orientation="vertical" flexItem />
        <Button
          size="small"
          variant="outlined"
          startIcon={<TableChartRoundedIcon />}
          disabled={rows.length === 0}
          onClick={() => exportComparisonToExcel(rows)}
        >
          Export Excel
        </Button>
        {/* Added 2026-09-24 per an explicit "data export at pdf file"
            request - same branded letterhead/table treatment as the Excel
            export above, see exportComparisonToPdf in comparisonExport.ts. */}
        <Button
          size="small"
          variant="outlined"
          startIcon={<PictureAsPdfRoundedIcon />}
          disabled={rows.length === 0}
          onClick={() => exportComparisonToPdf(rows)}
        >
          Export PDF
        </Button>
      </FilterBar>

      {rowsError ? (
        <ErrorState onRetry={refetchRows} />
      ) : rowsLoading ? (
        <LoadingState label="Loading comparison data..." />
      ) : (
        <>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            spacing={0.5}
          >
            <Typography variant="body2" color="text.secondary">
              Viewing: <strong>{viewingScope}</strong> &middot; Rows: <strong>{rows.length}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Window: {dateRange ? `${dayjs(dateRange.min).format('D MMM YYYY')} → ${dayjs(dateRange.max).format('D MMM YYYY')} (IST)` : 'N/A'}
            </Typography>
          </Stack>
          <AccuracyKpis rows={rows} />
          <AccuracyTrendChart rows={rows} />
          <ComparisonGrid rows={rows} />
        </>
      )}
    </Stack>
  );
}
