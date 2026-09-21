import { useMemo } from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { useListSitesQuery } from '@/features/sites/sitesApi';
import { useGetCurrentObservationsQuery } from '@/features/weather/weatherApi';
import { useListUsersQuery } from '@/features/users/usersApi';
import type { CurrentObservation } from '@/features/weather/types';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { useSevenDayObservations } from '@/pages/reports/useSevenDayObservations';
import { HazardMap } from './components/HazardMap';
import { RiskIntensityDashboard } from './components/RiskIntensityDashboard';
import { CurrentDayAdvisory } from './components/CurrentDayAdvisory';
import { WeeklyAdvisories } from './components/WeeklyAdvisories';
import {
  getActiveCyclone,
  buildWeatherParameterRiskRows,
  buildHazardRiskRows,
  buildWeeklyAdvisories,
  buildCurrentDayAdvisories,
} from './hazardData';

export default function HazardsPage() {
  const { data: sitesPage, isLoading: sitesLoading, isError, refetch } = useListSitesQuery({ pageSize: 500 });
  const sites = useMemo(() => sitesPage?.items ?? [], [sitesPage]);
  const siteIds = useMemo(() => sites.map((s) => s.id), [sites]);

  const { data: observationsList, isLoading: obsLoading } = useGetCurrentObservationsQuery(siteIds, {
    skip: siteIds.length === 0,
  });
  const obsBySiteId = useMemo(() => {
    const map: Record<string, CurrentObservation> = {};
    (observationsList ?? []).forEach((obs) => {
      map[obs.siteId] = obs;
    });
    return map;
  }, [observationsList]);

  const { days, isLoading: forecastLoading } = useSevenDayObservations(siteIds);
  // Every registered user, matched to a Current Day Advisory row by circle
  // to preview who'd be notified and on which channel - see
  // notificationRecipients.ts's doc comment (mock preview only, no real
  // WhatsApp/SMS/email gateway behind it).
  const { data: registeredUsers = [] } = useListUsersQuery();

  const cyclone = useMemo(() => getActiveCyclone(), []);
  const parameterRows = useMemo(() => buildWeatherParameterRiskRows(sites, obsBySiteId), [sites, obsBySiteId]);
  const hazardRows = useMemo(() => buildHazardRiskRows(sites, obsBySiteId, cyclone), [sites, obsBySiteId, cyclone]);
  const weeklyRows = useMemo(() => buildWeeklyAdvisories(sites, days), [sites, days]);
  const currentDayRows = useMemo(() => buildCurrentDayAdvisories(weeklyRows), [weeklyRows]);

  const loading = sitesLoading || obsLoading;

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Hazards & Advisories"
        description="Special cyclone bulletin, today's district risk intensity across every hazard, and the weekly monsoon-preparation advisory"
      />

      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : loading ? (
        <LoadingState label="Loading hazard data..." />
      ) : (
        <>
          <Alert severity="info" variant="outlined">
            Lightning, Flood, Avalanche, Fog and Cyclone all live as parameter toggles on the single Hazard Map
            below, the same one-map pattern the Live Map itself uses for Temperature, Rainfall, Cloud, Visibility
            and Snowfall. Snowfall stays on the Live Map since it's an everyday weather reading rather than a
            hazard advisory.
          </Alert>

          <div>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
              Hazard Map
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Lightning, Flood and Avalanche are colored per district straight from current conditions; Fog is
              scoped to visibility during actual foggy conditions (flood risk *is* rainfall risk - no separate
              hydrological model behind it yet, see hazardData.ts's getFloodRisk). Cyclone swaps the choropleth
              for the active storm's own track instead, since it's a moving system rather than a per-district
              reading - it shows "no live data" until a real IMD/JTWC feed is wired in, rather than a placeholder
              storm. Switch between them with the toggle on the map.
            </Typography>
            <HazardMap sites={sites} observations={obsBySiteId} cyclone={cyclone} />
          </div>

          <div>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
              Today&apos;s Risk Intensity of Districts
            </Typography>
            <RiskIntensityDashboard parameterRows={parameterRows} hazardRows={hazardRows} />
          </div>

          <div>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
              Current Day Advisory
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Today's line out of the Daily Weather Alerts Report - the same per-circle outlook the weekly bulletin
              below tracks across the week, just for today. Recipients previews who'd be notified via WhatsApp/SMS/
              Email, based on the location and channels registered users chose at sign-up.
            </Typography>
            {forecastLoading ? (
              <LoadingState label="Loading today's outlook..." />
            ) : (
              <CurrentDayAdvisory rows={currentDayRows} users={registeredUsers} />
            )}
          </div>

          <div>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
              Weekly Advisories (Monsoon Preparation)
            </Typography>
            {forecastLoading ? (
              <LoadingState label="Loading 7-day outlook..." />
            ) : (
              <WeeklyAdvisories rows={weeklyRows} />
            )}
          </div>
        </>
      )}
    </Stack>
  );
}
