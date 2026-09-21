import { useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useListSitesQuery } from '@/features/sites/sitesApi';
import { useGetObservationsAtTimeQuery } from '@/features/weather/weatherApi';
import type { CurrentObservation } from '@/features/weather/types';
import type { Site } from '@/features/sites/types';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { buildDistrictRiskIndex, buildStateRiskIndex, normalizeName, splitCircleStateName } from '@/utils/districtRisk';
import { useSevenDayObservations } from '@/pages/reports/useSevenDayObservations';
import { DemoModeTicker } from './components/DemoModeTicker';
import { MapControls } from './components/MapControls';
import { ParameterToolbar } from './components/ParameterToolbar';
import { MapViewControls } from './components/MapViewControls';
import { RiskLegend } from './components/RiskLegend';
import { WeatherDetailsPanel, WEATHER_DETAILS_PANEL_WIDTH } from './components/WeatherDetailsPanel';
import { NetworkWeatherPanel } from './components/NetworkWeatherPanel';
import { TimelineScrubber } from './components/TimelineScrubber';
import { ClusteredSiteMarkers } from './components/ClusteredSiteMarkers';
import { WindFlowLayer } from './components/WindFlowLayer';
import { DistrictLayer } from './components/DistrictLayer';
import { StateBoundaryLayer } from './components/StateBoundaryLayer';
import { StateOutlinesLayer } from './components/StateOutlinesLayer';
import { IndiaBoundaryOutline } from './components/IndiaBoundaryOutline';
import { useMapTimeline } from './useMapTimeline';
import { useDistrictBoundariesForStates, useIndiaStates, useVisibleStates } from './useDistrictBoundaries';
import { extractStateName } from './districtGeo';
import { layerRisk, layerReading, MAP_LAYERS, LAYER_COLORS, type MapLayer } from './mapLayers';

export type Basemap = 'street' | 'satellite';

const INDIA_CENTER: [number, number] = [22.9734, 78.6569];

// High enough to return every real station in one page regardless of
// network size (INDUS_CIRCLES has 57,000+ rows as of 2026-09-17, split
// across just 4 circles) - the backend applies no upper cap, so this is
// effectively "give me everything you have." Bump further if the table
// grows past this.
const SITE_PAGE_SIZE = 100000;

// This USED to cap live weather at 300 towers at a time, because the
// backend fetched weather one DB round trip per tower
// (WeatherService.currentFor) - requesting it for a whole circle (5,000-
// 19,000 towers) would have fired thousands of sequential queries in a
// single request and hung the backend. WeatherService now batches this
// into a handful of queries total regardless of tower count (see
// IndusWeatherService.currentForBatch on the backend), so a full
// circle/state selection can request live weather for every one of its
// towers at once. This constant is now just a last-resort circuit breaker
// for a pathologically large selection (e.g. every circle nationwide at
// once, ~57,000+ towers as of 2026-09-17) rather than the routine cap it
// used to be - raise it if the real dataset ever grows close to it.
const WEATHER_FETCH_LIMIT = 250000;

const TILE_LAYERS: Record<Basemap, { url: string; attribution: string }> = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
  },
};

export default function LiveMapPage() {
  const [state, setState] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const [layer, setLayer] = useState<MapLayer>('temperature');
  const [basemap, setBasemap] = useState<Basemap>('street');
  const [showWind, setShowWind] = useState(false);
  // Matches the reference product exactly (confirmed against its own
  // screen recording): the map ALWAYS opens on the boundary choropleth
  // (state -> district as you drill down, colored by whichever parameter
  // is active) with no individual tower pins, at every zoom level - and
  // "Towers" is a fully independent manual switch (top-right,
  // MapViewControls) that the user clicks whenever they specifically want
  // pins overlaid, not something that turns on by itself when a state is
  // picked. Picking a state/district only changes which boundary polygons
  // are drawn; it deliberately does NOT touch this flag.
  const [showTowers, setShowTowers] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [showNetworkPanel, setShowNetworkPanel] = useState(false);
  // Opened by clicking a district on the choropleth (handleSelectDistrict) -
  // NOT by picking one from the State/District dropdown (MapControls calls
  // setDistrict directly), so browsing via the dropdown alone never pops
  // this open uninvited. Reuses NetworkWeatherPanel's exact layout, just
  // scoped to this one district's monitored towers instead of the whole
  // network - see the render below for how its data is scoped down.
  const [showDistrictPanel, setShowDistrictPanel] = useState(false);

  const mapWrapperRef = useRef<HTMLDivElement>(null);

  const timeline = useMapTimeline();

  const { data: sitesPage, isLoading: sitesLoading, isError: sitesError, refetch } = useListSitesQuery({
    state: state ?? undefined,
    district: district ?? undefined,
    pageSize: SITE_PAGE_SIZE,
  });
  const sites = useMemo(() => sitesPage?.items ?? [], [sitesPage]);
  const siteIds = useMemo(() => sites.map((s) => s.id), [sites]);
  const weatherAvailable = siteIds.length > 0 && siteIds.length <= WEATHER_FETCH_LIMIT;

  // Only needed to color individual tower markers - skipped entirely while
  // towers aren't shown (the default nationwide view) so loading the map
  // doesn't also fire a live-weather batch fetch for every one of the
  // 57,000+ real sites just to throw the result away unrendered.
  const { data: observationsList } = useGetObservationsAtTimeQuery(
    { siteIds, at: timeline.at },
    { skip: !weatherAvailable || !showTowers }
  );

  const observations = useMemo(() => {
    const map: Record<string, CurrentObservation> = {};
    (observationsList ?? []).forEach((obs) => {
      map[obs.siteId] = obs;
    });
    return map;
  }, [observationsList]);

  // A second, state-scoped-but-not-district-filtered (or, with no state
  // picked yet, nationwide) view of the sites - this is what drives the
  // district choropleth, since every district needs to be colored by its
  // own worst risk, not just whichever single district the dropdown
  // currently has selected.
  const { data: riskScopeSitesPage } = useListSitesQuery({ state: state ?? undefined, pageSize: SITE_PAGE_SIZE });
  const riskScopeSites = useMemo(() => riskScopeSitesPage?.items ?? [], [riskScopeSitesPage]);
  const riskScopeSiteIds = useMemo(() => riskScopeSites.map((s) => s.id), [riskScopeSites]);
  const riskScopeWeatherAvailable = riskScopeSiteIds.length > 0 && riskScopeSiteIds.length <= WEATHER_FETCH_LIMIT;

  const { data: riskScopeObservationsList } = useGetObservationsAtTimeQuery(
    { siteIds: riskScopeSiteIds, at: timeline.at },
    { skip: !riskScopeWeatherAvailable }
  );

  // Also feeds the wind-flow overlay below, so the animated field has
  // samples spread across the whole visible region (not just whichever
  // single district the dropdown currently narrows `sites`/`observations`
  // down to).
  const riskScopeObservations = useMemo(() => {
    const map: Record<string, CurrentObservation> = {};
    (riskScopeObservationsList ?? []).forEach((obs) => {
      map[obs.siteId] = obs;
    });
    return map;
  }, [riskScopeObservationsList]);

  // Only fetched while the network Weather details panel (opened via the
  // (i) button) is actually open - skip is baked into useSevenDayObservations
  // itself (siteIds.length === 0), so passing an empty array while the
  // panel is closed avoids firing seven extra queries for nothing.
  const { days: networkDays } = useSevenDayObservations(showNetworkPanel ? riskScopeSiteIds : []);
  // Same idea, scoped to the one district's sites (`siteIds` above is
  // already narrowed to state+district via useListSitesQuery) - powers the
  // district panel's own 7-day forecast section.
  const { days: districtDays } = useSevenDayObservations(showDistrictPanel ? siteIds : []);

  // The district panel needs real-time "now" readings for exactly this
  // district's sites, same as the network panel needs them nationwide - but
  // `observations` above is only fetched while `showTowers` is on (see its
  // own comment). `riskScopeObservations` is already fetched unconditionally
  // for the whole state, so this just narrows that down to this district's
  // sites instead of firing yet another weather request.
  const districtObservations = useMemo(() => {
    const map: Record<string, CurrentObservation> = {};
    sites.forEach((site) => {
      const obs = riskScopeObservations[site.id];
      if (obs) map[site.id] = obs;
    });
    return map;
  }, [sites, riskScopeObservations]);

  // Per-district worst-risk color, keyed the same way DistrictLayer looks
  // it up. No averaged reading is computed any more - the tooltip is a
  // location + monitored-tower-count summary, not a data readout, per
  // explicit request (color alone conveys severity).
  const districtRiskIndex = useMemo(() => {
    return buildDistrictRiskIndex(
      riskScopeSites,
      riskScopeObservations,
      (site, obs) => layerRisk(layer, obs, site)
    );
  }, [riskScopeSites, riskScopeObservations, layer]);

  // One level coarser than districtRiskIndex above: a risk color per STATE
  // rather than per district, so the default (nothing-picked-yet) view -
  // StateOutlinesLayer, below - can show every state's own worst current
  // condition and visibly change color as the timeline's hourly/daily
  // slider moves, before drilling into any single state. `riskScopeSites`
  // is nationwide whenever `state` is unset (the only time this index is
  // actually rendered), so this naturally covers every state at once.
  const stateRiskIndex = useMemo(() => {
    return buildStateRiskIndex(
      riskScopeSites,
      riskScopeObservations,
      (site, obs) => layerRisk(layer, obs, site)
    );
  }, [riskScopeSites, riskScopeObservations, layer]);

  // `state` holds the raw DB `Site.state` (circle) value, e.g. "Bihar &
  // Jharkhand" for a combined circle - every REST filter downstream needs
  // exactly that value. Boundary files, though, only exist per REAL
  // government state (bihar.json, jharkhand.json - never a combined
  // "bihar-jharkhand.json"), so a combined circle needs BOTH files fetched
  // and merged. `splitCircleStateName` is the same helper StateOutlinesLayer
  // itself uses to color both real states together; an ordinary,
  // non-combined circle just splits into itself, so this is a no-op there.
  const constituentStates = useMemo(() => (state ? splitCircleStateName(state) : []), [state]);

  // District boundaries (the previously non-government-approved data
  // source has been replaced - see districtGeo.ts's header) are now only
  // ever loaded for the state(s) the user has drilled into, never
  // Pan-India: with no state picked, the map shows plain state outlines
  // instead (StateOutlinesLayer, fed by the india-states.json dataset
  // below), and picking a state hands off to the district-level choropleth
  // here.
  const indiaStates = useIndiaStates();
  const { get: getBoundary } = useDistrictBoundariesForStates(constituentStates);

  // RBAC scoping (section 5 of the scope doc) AND real-data scoping
  // together: a Pan-India admin sees every state/UT that actually has a
  // monitored site; an operator/viewer only sees the intersection with
  // their own `assignedStates`. `useVisibleStates()` (shared with
  // FloodMap/RegionRiskMap/the Reports state filter, so this applies
  // everywhere at once - see its own doc comment) intersects the real
  // india-states.json boundary list with both RBAC and `useListStatesQuery()`
  // - so a state/UT with zero real sites (most of India, on the current
  // small `INDUS_CIRCLES` dataset) doesn't clutter the dropdown or the
  // default nationwide outline layer.
  const { features: visibleStateFeatures, names: stateOptions } = useVisibleStates();

  // Merges every constituent state's own boundary-fetch status into one -
  // for an ordinary circle this is just that one state's status unchanged;
  // for a combined circle it's both real states' districts drawn together,
  // "loading" until every one of them has resolved, and "failed" only if
  // ALL of them failed (one real state's districts still beat none at all).
  const districtBoundary = useMemo(() => {
    if (constituentStates.length === 0) return null;
    const statuses = constituentStates.map((s) => getBoundary(s));
    return {
      features: statuses.flatMap((s) => s.features),
      loading: statuses.some((s) => s.loading),
      error: statuses.length > 0 && statuses.every((s) => s.error),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [constituentStates, getBoundary]);

  const selectedStateFeatures = useMemo(() => {
    if (constituentStates.length === 0) return [];
    const wanted = new Set(constituentStates.map(normalizeName));
    return indiaStates.features.filter((f) => wanted.has(normalizeName(extractStateName(f) ?? '')));
  }, [indiaStates.features, constituentStates]);

  const anyBoundaryLoading = state ? !!districtBoundary?.loading : indiaStates.loading;
  const allBoundariesFailed = state
    ? !districtBoundary?.loading && (districtBoundary?.features.length ?? 0) === 0
    : !indiaStates.loading && indiaStates.error;

  const handleSelectDistrict = (districtName: string, districtState: string) => {
    setState(districtState);
    setDistrict(districtName);
    setSelectedSite(null);
    setShowNetworkPanel(false);
    setShowDistrictPanel(true);
  };

  const handleSelectState = (stateName: string) => {
    setState(stateName);
    setDistrict(null);
    setShowDistrictPanel(false);
  };

  // Any one Weather details panel (per-tower, nationwide, or per-district)
  // occupies the right edge of the map when open, so the top-right view
  // controls and the legend shift left by its width instead of being
  // covered by it. All three are mutually exclusive (see
  // handleSelectSite/handleOpenInfo/handleSelectDistrict).
  const rightControlOffset =
    selectedSite || showNetworkPanel || showDistrictPanel ? WEATHER_DETAILS_PANEL_WIDTH + 24 : 12;

  const handleSelectSite = (site: Site) => {
    setShowNetworkPanel(false);
    setShowDistrictPanel(false);
    setSelectedSite(site);
  };

  const handleOpenInfo = () => {
    setSelectedSite(null);
    setShowDistrictPanel(false);
    setShowNetworkPanel(true);
  };

  if (sitesLoading) return <LoadingState label="Loading tower network..." />;
  if (sitesError) return <ErrorState title="Failed to load sites" onRetry={refetch} />;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <DemoModeTicker />
      <Box ref={mapWrapperRef} sx={{ position: 'relative', flex: 1, minHeight: 0 }}>
      <MapContainer
        center={INDIA_CENTER}
        zoom={5}
        minZoom={4}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          key={basemap}
          url={TILE_LAYERS[basemap].url}
          attribution={TILE_LAYERS[basemap].attribution}
        />
        <IndiaBoundaryOutline />
        {!state && visibleStateFeatures.length > 0 && (
          <StateOutlinesLayer
            features={visibleStateFeatures}
            onSelectState={handleSelectState}
            stateRisk={stateRiskIndex}
            colors={LAYER_COLORS[layer]}
          />
        )}
        {state && districtBoundary && districtBoundary.features.length > 0 && (
          <>
            <DistrictLayer
              stateName={state}
              features={districtBoundary.features}
              districtRisk={districtRiskIndex}
              colors={LAYER_COLORS[layer]}
              selectedDistrict={district}
              onSelectDistrict={handleSelectDistrict}
              enableFitBounds
            />
            <StateBoundaryLayer stateName={state} features={selectedStateFeatures} />
          </>
        )}
        {showTowers && (
          <ClusteredSiteMarkers sites={sites} observations={observations} layer={layer} onSelectSite={handleSelectSite} />
        )}
        <WindFlowLayer
          sites={riskScopeSites}
          observations={riskScopeObservations}
          enabled={showWind}
          boundaryFeatures={state ? selectedStateFeatures : undefined}
        />
      </MapContainer>

      {anyBoundaryLoading && (
        <Chip
          label={state ? 'Loading district boundaries...' : 'Loading state boundaries...'}
          size="small"
          sx={{ position: 'absolute', bottom: 84, left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}
        />
      )}
      {!anyBoundaryLoading && allBoundariesFailed && (
        <Chip
          label={
            state
              ? 'District boundaries unavailable - showing site markers only'
              : 'State boundaries unavailable - showing site markers only'
          }
          size="small"
          color="warning"
          sx={{ position: 'absolute', bottom: 84, left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}
        />
      )}
      {showTowers && !weatherAvailable && siteIds.length > 0 && (
        <Chip
          label={`${siteIds.length.toLocaleString()} towers shown (clustered) - narrow to a smaller circle/state/district to see live weather coloring`}
          size="small"
          sx={{ position: 'absolute', bottom: 48, left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}
        />
      )}
      {!showTowers && !anyBoundaryLoading && (
        <Chip
          label={`Showing ${state ? '' : 'state-level '}${(MAP_LAYERS.find((l) => l.value === layer)?.label ?? 'temperature').toLowerCase()} boundaries - use the Towers switch (top right) to see individual tower locations`}
          size="small"
          sx={{ position: 'absolute', bottom: 48, left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}
        />
      )}

      <ParameterToolbar layer={layer} onChangeLayer={setLayer} showWind={showWind} onToggleWind={setShowWind} />
      <MapControls
        state={state}
        onChangeState={setState}
        district={district}
        onChangeDistrict={setDistrict}
        stateOptions={stateOptions}
      />
      <MapViewControls
        basemap={basemap}
        onChangeBasemap={setBasemap}
        showTowers={showTowers}
        onToggleTowers={setShowTowers}
        onOpenInfo={handleOpenInfo}
        fullscreenTargetRef={mapWrapperRef}
        right={rightControlOffset}
      />
      <RiskLegend layer={layer} showWindGradient={showWind} right={rightControlOffset} />
      {selectedSite && <WeatherDetailsPanel site={selectedSite} onClose={() => setSelectedSite(null)} />}
      {showNetworkPanel && (
        <NetworkWeatherPanel
          sites={riskScopeSites}
          observations={riskScopeObservations}
          days={networkDays}
          onClose={() => setShowNetworkPanel(false)}
        />
      )}
      {showDistrictPanel && district && (
        <NetworkWeatherPanel
          sites={sites}
          observations={districtObservations}
          days={districtDays}
          onClose={() => setShowDistrictPanel(false)}
          title={district}
          location={state ?? ''}
        />
      )}
      <TimelineScrubber
        mode={timeline.mode}
        onChangeMode={timeline.setMode}
        days={timeline.days}
        dayOffset={timeline.dayOffset}
        onChangeOffset={timeline.setDayOffset}
        hours={timeline.hours}
        hourOffset={timeline.hourOffset}
        onChangeHourOffset={timeline.setHourOffset}
        playing={timeline.playing}
        onTogglePlaying={timeline.togglePlaying}
        speed={timeline.speed}
        onChangeSpeed={timeline.setSpeed}
      />
      </Box>
    </Box>
  );
}
