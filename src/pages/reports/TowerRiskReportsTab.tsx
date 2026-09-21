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
import { computeOverallRisk } from './riskAggregation';
import { SiteRiskTable, type SiteRiskRow } from './components/SiteRiskTable';
import { RiskDistributionCharts } from './components/RiskDistributionCharts';
import { RegionRiskMap } from './components/RegionRiskMap';
import { ShortLongRangeForecast } from './components/ShortLongRangeForecast';
import { exportSiteRiskToExcel, exportSiteRiskToPdf } from './exportUtils';

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
    pageSize: 200,
  });
  const sites = useMemo(() => sitesPage?.items ?? [], [sitesPage]);
  const siteIds = useMemo(() => sites.map((s) => s.id), [sites]);

  const { data: observations, isLoading: obsLoading } = useGetCurrentObservationsQuery(siteIds, { skip: siteIds.length === 0 });
  // 7-day span feeding the Short-Range (day 1-3) / Long-Range (day 4-7)
  // forecast table below, per the scope document's own "Short and
  // Long-Range Prediction" sample.
  const { days: sevenDays, isLoading: sevenDayLoading } = useSevenDayObservations(siteIds);

  // A second, state-scoped-but-not-district-filtered (or, with no state
  // picked, nationwide) view of the sites, used only by the Region Map below
  // - every district in view needs its own worst-risk color, not just
  // whichever single district the District dropdown currently narrows the
  // table/export data down to (same reasoning as Live Map's `riskScopeSites`).
  const { data: mapSitesPage } = useListSitesQuery({ state: state ?? undefined, pageSize: 500 });
  const mapSites = useMemo(() => mapSitesPage?.items ?? [], [mapSitesPage]);
  const mapSiteIds = useMemo(() => mapSites.map((s) => s.id), [mapSites]);
  const { days: mapDays } = useSevenDayObservations(mapSiteIds);

  const handleSelectDistrictOnMap = (districtName: string, districtState: string) => {
    setState(districtState);
    setDistrict(districtName);
  };

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
              Region Map
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              District boundaries and state outline highlighted, colored by worst overall risk - click a district to
              filter the tables above
            </Typography>
            <RegionRiskMap
              sites={mapSites}
              days={mapDays}
              state={state}
              district={district}
              onSelectDistrict={handleSelectDistrictOnMap}
            />
          </div>

          <div>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
              Short-Range &amp; Long-Range Forecast
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Every weather parameter and hazard, per district - current day + next 2 days (Short-Range) and current
              day + next 6 days (Long-Range), per the scope document's daily alert report
            </Typography>
            {sevenDayLoading ? (
              <LoadingState label="Loading 7-day outlook..." />
            ) : (
              <ShortLongRangeForecast sites={sites} days={sevenDays} />
            )}
          </div>
        </>
      )}
    </Stack>
  );
}
