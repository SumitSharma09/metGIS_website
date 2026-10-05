import { useMemo, useState } from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import { FilterBar } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { useListDistrictsQuery, useListSitesQuery } from '@/features/sites/sitesApi';
import { useScopedStates } from '@/features/users/useScopedStates';
import { useVisibleStates } from '@/pages/live-map/useDistrictBoundaries';
import { useGetCurrentObservationsQuery } from '@/features/weather/weatherApi';
import { useSevenDayObservations } from './useSevenDayObservations';
import { useSkymetSevenDayForecast } from './useSkymetSevenDayForecast';
import { computeOverallRisk } from './riskAggregation';
import { SiteRiskTable, type SiteRiskRow } from './components/SiteRiskTable';
import { RiskDistributionCharts } from './components/RiskDistributionCharts';
import { ShortLongRangeForecast } from './components/ShortLongRangeForecast';
import { exportSiteRiskToExcel, exportSiteRiskToPdf } from './exportUtils';

// This table needs EVERY real site in scope to group correctly by district -
// the previous pageSize (200) only ever returned the first N rows the
// backend's default (unsorted-by-district) order happened to return, which
// meant this whole tab showed only whichever 2-3 districts those first rows
// fell in (e.g. "Agar Malwa") EVERY time, nationwide, regardless of how many
// real districts actually exist - not dummy data, just a pagination cap that
// silently truncated the real dataset. Fixed 2026-09-22 per explicit report:
// "why they show me agar malwa or 2-3 district every time". Same "give me
// every site" pattern already used for the Alerts page's forecast feed
// (useSkymetForecastAlerts.ts) - the real indus_locations table has
// 57,000+ rows and the backend applies no upper cap on pageSize.
const SITE_PAGE_SIZE = 100000;

export function TowerRiskReportsTab() {
  const [state, setState] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);

  // Every government-recognized state/UT the signed-in user is RBAC-allowed
  // to see (Jammu and Kashmir/Ladakh/Arunachal Pradesh included) - this
  // dropdown used to read from `useListStatesQuery()`, the site-derived
  // list, which left out any state/UT with zero monitored demo sites. See
  // `useVisibleStates()`'s own doc comment for the full story.
  const { names: states } = useVisibleStates();
  const { data: districts = [] } = useListDistrictsQuery(state ?? undefined);
  const { isPanIndia, assignedStates } = useScopedStates();
  const { data: sitesPage, isLoading: sitesLoading, isError, refetch } = useListSitesQuery({
    state: state ?? undefined,
    district: district ?? undefined,
    pageSize: SITE_PAGE_SIZE,
  });
  const sites = useMemo(() => sitesPage?.items ?? [], [sitesPage]);
  const siteIds = useMemo(() => sites.map((s) => s.id), [sites]);

  const { data: observations, isLoading: obsLoading } = useGetCurrentObservationsQuery(siteIds, { skip: siteIds.length === 0 });
  // 7-day span feeding the Short-Range (day 1-3) / Long-Range (day 4-7)
  // forecast table below, per the scope document's own "Short and
  // Long-Range Prediction" sample. Still needed for Humidity, Visibility,
  // Lightning, Flood and Fog - see ShortLongRangeForecast's own doc comment
  // on why those five stay on this hourly source.
  const { days: sevenDays, isLoading: sevenDayLoading } = useSevenDayObservations(siteIds);
  // Real per-day Skymet vendor outlook for the same site list - the source
  // for Rainfall, Temperature, Wind Speed, Snowfall and Avalanche as of
  // 2026-09-22 (see useSkymetSevenDayForecast's own doc comment).
  const { days: skymetDays, isLoading: skymetLoading } = useSkymetSevenDayForecast(sites);

  const rows: SiteRiskRow[] = useMemo(() => {
    const bySite = new Map(sites.map((s) => [s.id, s]));
    return (observations ?? [])
      .map((obs) => {
        const site = bySite.get(obs.siteId);
        if (!site) return null;
        return { site, obs, overallRisk: computeOverallRisk(obs) } satisfies SiteRiskRow;
      })
      .filter((r): r is SiteRiskRow => r !== null)
      .sort((a, b) => a.site.name.localeCompare(b.site.name));
  }, [observations, sites]);

  const loading = sitesLoading || obsLoading;

  return (
    <Stack spacing={2}>
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
          onClick={() => exportSiteRiskToExcel(rows)}
        >
          Export Excel
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<PictureAsPdfRoundedIcon />}
          disabled={rows.length === 0}
          onClick={() => exportSiteRiskToPdf(rows)}
        >
          Export PDF
        </Button>
      </FilterBar>

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : loading ? (
        <LoadingState label="Loading tower risk data..." />
      ) : (
        <>
          <RiskDistributionCharts rows={rows} />

          <div>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
              Site Risk Table
            </Typography>
            <SiteRiskTable rows={rows} />
          </div>

          <div>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
              Short-Range &amp; Long-Range Forecast
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Every weather parameter and hazard, per district - current day + next 2 days (Short-Range) and current
              day + next 6 days (Long-Range), per the scope document's daily alert report
            </Typography>
            {sevenDayLoading || skymetLoading ? (
              <LoadingState label="Loading 7-day outlook..." />
            ) : (
              <ShortLongRangeForecast sites={sites} days={sevenDays} skymetDays={skymetDays} />
            )}
          </div>
        </>
      )}
    </Stack>
  );
}
