import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useListSitesQuery } from '@/features/sites/sitesApi';
import { useGetObservationsAtTimeQuery, useGetDistrictAggregateQuery } from '@/features/weather/weatherApi';
import { useDebouncedValue } from '@/utils/useDebouncedValue';
import type { CurrentObservation } from '@/features/weather/types';
import type { DistrictWeatherAggregate } from '@/features/weather/weatherApi';
import type { Site } from '@/features/sites/types';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import {
  buildDistrictRiskIndex,
  buildRiskIndex,
  buildStateRiskIndex,
  buildStateSourceMap,
  normalizeName,
  splitCircleStateName,
  type DistrictRiskInfo,
} from '@/utils/districtRisk';
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
import { DistrictHullLayer } from './components/DistrictHullLayer';
import { IndusHullTicker } from './components/IndusHullTicker';
import { StateBoundaryLayer } from './components/StateBoundaryLayer';
import { StateOutlinesLayer } from './components/StateOutlinesLayer';
import { IndiaBoundaryOutline } from './components/IndiaBoundaryOutline';
import { useMapTimeline } from './useMapTimeline';
import { useDistrictBoundariesForStates, useIndiaStates, useVisibleStates } from './useDistrictBoundaries';
import { extractStateName } from './districtGeo';
import { resolveGeoDistricts } from './geoDistrict';
import { layerRisk, layerGradientValue, colorForValue, LAYER_COLORS, type MapLayer } from './mapLayers';

export type Basemap = 'street' | 'satellite';

const INDIA_CENTER: [number, number] = [22.9734, 78.6569];
const INDIA_ZOOM = 5;

/** Flies the camera back to the default nationwide (India) view whenever the
 *  state selection is CLEARED - added 2026-09-29 per explicit request ("if
 *  not selected state then redirect the indian map"). Without this, picking
 *  a state (which flies the camera in via DistrictLayer's/DistrictHullLayer's
 *  own FitBoundsToState-style effect) and then clearing that selection left
 *  the camera sitting wherever it had zoomed to: DistrictLayer/
 *  DistrictHullLayer - and the fit-bounds effect living inside them - only
 *  render, and so only exist, while `state` is truthy (see the
 *  `{state && ... && (<DistrictLayer/>)}` conditional a bit further down), so
 *  they unmount the instant `state` goes back to null with nothing left to
 *  fly the camera back out again.
 *
 *  Only fires on the actual TRANSITION from a state being selected to none -
 *  gated on `hadStateRef` rather than firing whenever `state` is merely
 *  falsy, so it does NOT re-trigger on the initial mount (the map already
 *  opens on this exact India view - nothing to fly back to) and does not
 *  fight with DistrictLayer's own fit-bounds while a state stays selected
 *  (picking a different state/district there is handled entirely by that
 *  component's own effect, not this one). */
function ResetToIndiaView({ state }: { state: string | null }) {
  const map = useMap();
  const hadStateRef = useRef(false);

  useEffect(() => {
    if (state) {
      hadStateRef.current = true;
      return;
    }
    if (hadStateRef.current) {
      hadStateRef.current = false;
      map.flyTo(INDIA_CENTER, INDIA_ZOOM, { duration: 0.6 });
    }
  }, [state, map]);

  return null;
}

/**
 * Centered "something's processing" popup for the map - replaces the old
 * pair of small chips tucked at the bottom (one for a state/district switch
 * still fetching sites, one for boundary polygons still loading) with a
 * single, more visible card in the middle of the map. Added 2026-09-29 per
 * explicit request ("data loading, map loading anything is processing
 * background in live map they middle show of the loading.. pop up with
 * professional way") - the bottom-pinned chip was easy to miss against the
 * map/legend/controls also competing for that same strip along the bottom
 * edge, and read as an afterthought rather than a deliberate status.
 *
 * A `Paper` card (real elevation/shadow + rounded corners) instead of a flat
 * `Chip`, with a translucent/blurred backdrop so it reads clearly over
 * whatever colors are underneath it on any basemap (street or satellite,
 * light or dark theme) - this is the "professional way" ask, not just a
 * change of position. `pointerEvents: 'none'` keeps it a pure status
 * indicator: the map underneath stays fully pannable/clickable while this
 * shows, matching every prior decision in this file that a loading signal
 * should never block interaction, just announce itself clearly.
 *
 * Callers pass a single `label` - see `processingLabel` below for how the
 * two underlying signals (`showSitesSwitchingChip`, `anyBoundaryLoading`)
 * are combined into the one message this shows at a time.
 */
function ProcessingOverlay({ label }: { label: string }) {
  return (
    <Paper
      elevation={8}
      role="status"
      aria-live="polite"
      sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2.5,
        py: 1.5,
        borderRadius: 3,
        pointerEvents: 'none',
        backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.94),
        backdropFilter: 'blur(6px)',
        border: (theme) => `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
      }}
    >
      <CircularProgress size={22} thickness={4.5} />
      <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
        {label}
      </Typography>
    </Paper>
  );
}

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

// How long the district/state choropleth's own weather fetch has to be
// continuously pending before `ProcessingOverlay` says so - see
// `showSlowRiskScopeFetch`'s own doc comment further down for the full
// reasoning. Comfortably above how long even a slow-ish ordinary fetch
// takes (so routine ticks never trip it), comfortably below how long a
// person would sit wondering whether the map is broken.
const SLOW_FETCH_MS = 2500;

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
  // Used to be its own independent toggle on the toolbar (a separate "Wind"
  // button next to the parameter buttons), which is what caused the
  // original "click Wind, mouse-over shows nothing" bug - it turned the
  // flow arrows on without ever making Wind the active parameter. Fixed
  // that, then per follow-up request ("please merge this windflow with
  // wind button") removed the separate control entirely: there is now only
  // one Wind button (in ParameterToolbar, part of the normal parameter
  // group), and this derives straight from it, so selecting Wind as the
  // parameter shows the flow-arrows overlay automatically, and selecting
  // any other parameter hides it automatically. No independent state left
  // to get out of sync with `layer`.
  const showWind = layer === 'wind';
  // Matches the reference product exactly (confirmed against its own
  // screen recording): the map ALWAYS opens on the boundary choropleth
  // (state -> district as you drill down, colored by whichever parameter
  // is active) with no individual tower pins, at every zoom level.
  // "Indus" (internal name: Towers) is a manual switch (top-right,
  // MapViewControls) the user clicks whenever they specifically want pins
  // overlaid.
  //
  // UPDATE 2026-09-30, per explicit request ("Indus show after some click
  // state or choose state then indus section show other default live-map
  // hide the indus section"): the switch itself is now HIDDEN until a state
  // is picked (see `showTowersToggle` passed to <MapViewControls> below),
  // not just off by default - flipping it on nationwide used to still be
  // possible and, per `weatherAvailable`'s own very high ceiling
  // (WEATHER_FETCH_LIMIT), would fetch live weather for every monitored
  // tower nationwide (57,000+) to color the clustered pins - the exact
  // "fetch every tower at once" shape nationwide's own choropleth was moved
  // OFF of (see the district-aggregate work above). Hiding the switch
  // nationwide closes that door entirely, rather than just defaulting it
  // off and hoping it's never flipped on too early. The effect just below
  // also force-clears `showTowers` the moment `state` is cleared (picking a
  // state no longer touches this flag, same as before, but LEAVING one no
  // longer leaves Indus mode stuck on with a now-hidden switch to turn it
  // back off).
  const [showTowers, setShowTowers] = useState(false);

  useEffect(() => {
    if (!state && showTowers) setShowTowers(false);
    // Deliberately only reacts to `state` clearing, not to `showTowers`
    // itself (which would make this a no-op tautology) - see the update
    // note on `showTowers` above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

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

  // Wraps the raw `setLayer` so switching the active parameter also snaps
  // the hourly timeline back to its live/starting hour - added 2026-09-30
  // per explicit request ("if someone change paramter choose in map they
  // timeline start with the starting"). Passed to <ParameterToolbar> below
  // in place of `setLayer` directly.
  const handleChangeLayer = (next: MapLayer) => {
    setLayer(next);
    timeline.resetToLive();
  };

  // Same reasoning as handleChangeLayer above, for the two other on-screen
  // controls that change WHAT the map is showing - added 2026-09-30 per
  // explicit request ("if someone change map street satellite and indus
  // section and another page then return map always they timeline start
  // from the starting"). Passed to <MapViewControls> below in place of
  // `setBasemap`/`setShowTowers` directly.
  const handleChangeBasemap = (next: Basemap) => {
    setBasemap(next);
    timeline.resetToLive();
  };
  const handleToggleTowers = (next: boolean) => {
    setShowTowers(next);
    timeline.resetToLive();
  };

  // Third part of the same request above ("...and another page then return
  // map always they timeline start from the starting"): this page is
  // route-mounted (see AppRoutes.tsx - a plain <Route>, not a kept-alive
  // tab), so navigating to another page and back already tears down and
  // recreates this whole component, including a fresh `useMapTimeline()` -
  // its own `hourOffset` init (`liveHourIndex(dayjs())`) already starts at
  // the live hour on every remount with no code needed here. This effect is
  // a deliberate belt-and-braces reset anyway, run exactly once on mount, in
  // case that assumption ever stops holding (e.g. a future layout change
  // that keeps this page alive across navigation instead of unmounting it) -
  // harmless today since it just repeats what the initial state already is.
  useEffect(() => {
    timeline.resetToLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Feeds the two big weather queries below instead of the raw, rapidly-
  // changing `timeline.at` - see useDebouncedValue's own doc comment for why:
  // dragging the hourly slider (or fast-forward playback) used to fire one
  // full nationwide weather request PER INTERMEDIATE HOUR touched along the
  // way (MUI's Slider fires onChange continuously while dragging, not just
  // on release), flooding the network - confirmed 2026-09-24 via the
  // browser's Network tab: 402 requests, ~41 MB, 2.5 minutes to drain from a
  // single scrub. That's what made the map's actual weather reading look
  // "frozen" even though the on-screen date/time label (which reads
  // `timeline.displayAt` directly, no network involved) updated instantly -
  // whatever rendered was just whichever of the hundreds of queued requests
  // happened to finish last, unrelated to wherever the slider had since
  // moved to.
  //
  // CORRECTION (2026-09-23, "mouse-over doesn't change the data for today's
  // forecast hours"): the line above used to say every on-screen `asOf` prop
  // still reads the instant `timeline.displayAt`, "so the timeline itself
  // still feels immediately responsive." That was true and also the real bug
  // - `DistrictLayer`/`StateOutlinesLayer`/`ClusteredSiteMarkers` all key
  // their Leaflet layer (and therefore rebuild their tooltip HTML) partly off
  // `asOf`, since react-leaflet's GeoJSON doesn't otherwise react to prop
  // changes on an already-mounted layer. Feeding that key the INSTANT
  // `displayAt` meant every single hourOffset change forced an immediate
  // layer rebuild - re-binding a tooltip that paired the brand-new hour label
  // with `districtRisk`'s avgValue from whatever the PREVIOUS debounced fetch
  // had resolved to, because the real data for the new hour hadn't landed
  // yet. Once it did land, `riskFingerprint` changed and the layer rebuilt
  // AGAIN with the correct value - but Leaflet doesn't reopen a tooltip on a
  // layer that was silently swapped out from under a stationary mouse, so
  // that correction was never seen; the tooltip just kept showing whatever
  // got bound on the very first pairing, hour after hour, in every district
  // (confirmed 2026-09-23: real per-hour district averages proven to vary
  // via direct SQL - e.g. Anantnag's real avg went 9.6 deg C at 20:00, 8.5 at
  // 21:00, 7.8 at 22:00 - while the map stayed pinned to 9.6 no matter which
  // of those hours was actually selected). This survived the `data`-vs-
  // `currentData` fix above because that fix addressed a different layer -
  // which RTK Query field to read - while this bug is about WHEN the tooltip
  // gets rebuilt at all. Every `asOf` prop below now passes `debouncedAt`
  // instead of `timeline.displayAt`, so a district layer only ever rebuilds
  // once the label's hour and its data are ready TOGETHER - the on-screen
  // hour label during a fast scrub now lags by the same ~400ms+fetch delay
  // the data itself does, instead of racing ahead of it. `displayAt` remains
  // available (and identical to `at` in every case reachable today, per its
  // own doc comment above) for anything that only needs the instant value
  // and never binds a Leaflet tooltip off it.
  const debouncedAt = useDebouncedValue(timeline.at, 400);

  const {
    data: sitesPage,
    isLoading: sitesLoading,
    isFetching: sitesIsFetching,
    isError: sitesError,
    refetch,
  } = useListSitesQuery({
    state: state ?? undefined,
    district: district ?? undefined,
    pageSize: SITE_PAGE_SIZE,
  });
  // Distinguishes a genuine mid-session state/district SWITCH from the very
  // first (bootstrap) load - added 2026-09-30 alongside the small "Loading..."
  // map-overlay chip below, per explicit request ("if there is processing
  // show they show loading... pop in the map"). `sitesIsFetching` alone goes
  // true on the FIRST load too (there's nothing cached yet to call it a
  // refetch of), and that first load already has its own full-page
  // `LoadingState` a few lines down (`if (sitesLoading) return ...`) - so
  // gating the small chip on `hasLoadedSitesOnceRef.current` as well keeps it
  // from doubling up with that full-page state on first paint, while still
  // showing it for every later switch (a different state or district picked,
  // which is the only thing this particular query's args depend on - the
  // hourly `at`/`debouncedAt` used elsewhere is NOT one of its args, so
  // ordinary hourly scrubbing/playback never touches this ref or this chip).
  // Mutated directly in the render body, matching this file's existing
  // `lastObservationsRef`/`lastRiskScopeObservationsRef` retain-last-good
  // pattern further down, rather than via an effect (an effect would lag a
  // render behind, letting the chip flash on the very load it's meant to
  // skip).
  //
  // Also used (as of 2026-09-29 follow-up) to gate the FULL-PAGE
  // `LoadingState` blank below, not just this chip - per explicit request
  // ("my timeline start why they show loading.... remove this, if all data
  // comes or after starting the timeline they do not show loading"). Every
  // one of this doc's own "timeline start" triggers (state pick, district
  // pick, clearing state, clearing district - see handleSelectState/
  // handleSelectDistrict/handleChangeState/handleChangeDistrict above) also
  // changes this query's `state`/`district` args, which is a brand-new RTK
  // Query cache key the very first time it's picked - so `sitesLoading`
  // (true whenever there's no cache yet for the CURRENT args) was going
  // true on every such switch, not just the app's true first load, blanking
  // the entire map/timeline behind a full-page "Loading tower network..."
  // screen each time. That's disruptive for what should be a quick
  // recolor, and unnecessary: the district/state choropleth's own data
  // comes from a separate, state-only-scoped query (`riskScopeSitesPage`
  // below) that isn't gated by this flag at all, so the map's actual colors
  // were often already able to update while this blank was covering them
  // for no reason. `hasLoadedSitesOnceRef.current` flips true after the
  // FIRST successful load and then stays true for the rest of the session
  // (it's never reset on a switch), so it's exactly the signal needed to
  // mean "any load after the very first one" - the full-page blank now only
  // ever shows once, on true app bootstrap; every later switch instead
  // falls through to the small, non-disruptive "Loading..." chip above,
  // which already existed for exactly this case.
  const hasLoadedSitesOnceRef = useRef(false);
  if (sitesPage !== undefined) hasLoadedSitesOnceRef.current = true;
  const showSitesSwitchingChip = sitesIsFetching && hasLoadedSitesOnceRef.current;
  const sites = useMemo(() => sitesPage?.items ?? [], [sitesPage]);
  const siteIds = useMemo(() => sites.map((s) => s.id), [sites]);
  const weatherAvailable = siteIds.length > 0 && siteIds.length <= WEATHER_FETCH_LIMIT;

  // Only needed to color individual tower markers - skipped entirely while
  // towers aren't shown (the default nationwide view) so loading the map
  // doesn't also fire a live-weather batch fetch for every one of the
  // 57,000+ real sites just to throw the result away unrendered.
  //
  // NOTE (2026-09-23, "mouse-over shows an earlier hour's reading, not the
  // one the slider is on"): this destructures `currentData`, not RTK
  // Query's plain `data` - the two are NOT interchangeable here.
  // `data` is documented as "the latest returned result REGARDLESS of hook
  // arg" - when `debouncedAt` changes to a new hour, RTK Query keeps `data`
  // pointed at the PREVIOUS hour's already-resolved result until the new
  // hour's request actually finishes, specifically so a plain loading
  // spinner doesn't flash on every arg change. `currentData` is the one
  // that's `undefined` unless it's the fetch for the CURRENT `debouncedAt`.
  // With the millisecond-jitter fix (see useMapTimeline.ts's `at`) already
  // deployed, `debouncedAt` now advances correctly and cleanly one real hour
  // at a time - but every one of those advances used to keep rendering
  // `data` from whichever earlier hour's fetch happened to resolve last,
  // for exactly as long as the new fetch took to land. That's a real but
  // STALE reading, which is why it looked like "the tooltip shows 13.5C for
  // four different displayed hours in a row, then jumps to 11.6C" - not a
  // constant offset, just whichever request finished most recently -
  // confirmed 2026-09-23 by re-checking every hour actually queried here
  // against the underlying district-average SQL, which is smoothly varying
  // for every one of those hours (so the DB was never the problem: this
  // hook was reading the wrong RTK Query field). `currentData` briefly goes
  // `undefined` while a newly-picked hour's fetch is in flight instead of
  // showing a mismatched older hour - correct per this app's own
  // never-fabricate/never-mismatch-data rule for real sensor readings.
  const { currentData: observationsList } = useGetObservationsAtTimeQuery(
    { siteIds, at: debouncedAt },
    { skip: !weatherAvailable || !showTowers }
  );

  // RETAIN-LAST-GOOD fallback (2026-09-25, "hourly-wise color coding is slow
  // and they show no data...they load after some time coloring - this is not
  // good for presentation"). `currentData` above is - correctly, per the
  // never-mismatch-data rule documented on it - `undefined` for the whole
  // window between a new hour being picked and that hour's batch fetch
  // actually landing. Until now `observations` below went straight from a
  // real reading to an EMPTY map for that whole window, which every marker
  // renders as "no data"/unmonitored - a real but misleading blank flash on
  // every single hour change, worse the longer the batch fetch takes (a
  // large circle can be 5,000-19,000+ towers, so this was very visible on
  // Madhya Pradesh specifically). This keeps the last batch that DID land,
  // scoped to the exact same state/district selection it was fetched for
  // (`observationsScopeKey`) so a genuine location change still starts from
  // a clean slate rather than briefly showing the PREVIOUS location's
  // readings under the new one's markers. `towerAsOf` below is unchanged -
  // it still only advances once `observationsList` itself lands - so the
  // retained reading and the "As of" hour shown for it always describe the
  // very same real fetch; this only holds a genuine previous-hour reading on
  // screen a little longer, it never invents or mismatches one.
  const observationsScopeKey = `${state ?? ''}|${district ?? ''}`;
  const lastObservationsRef = useRef<{ key: string; list: CurrentObservation[] } | null>(null);
  if (observationsList !== undefined) {
    lastObservationsRef.current = { key: observationsScopeKey, list: observationsList };
  }
  const effectiveObservationsList =
    observationsList ??
    (lastObservationsRef.current?.key === observationsScopeKey ? lastObservationsRef.current.list : undefined);

  const observations = useMemo(() => {
    const map: Record<string, CurrentObservation> = {};
    (effectiveObservationsList ?? []).forEach((obs) => {
      map[obs.siteId] = obs;
    });
    return map;
  }, [effectiveObservationsList]);

  // FOLLOW-UP (2026-09-23, "same problem again" after hard-refreshing with
  // the debouncedAt fix above deployed and confirmed live): `asOf={debouncedAt}`
  // was a real improvement but not the full fix. `debouncedAt` changes the
  // instant the debounce timer fires and a NEW fetch is kicked off - not when
  // that fetch actually resolves. `ClusteredSiteMarkers`/`DistrictLayer`/
  // `StateOutlinesLayer` all key their Leaflet layer (and rebuild their
  // tooltip HTML) off `asOf` the moment it changes, which is still BEFORE
  // `observations`/`riskScopeObservations` below have the new hour's actual
  // data - so the tooltip still gets rebuilt with a fresh hour label paired
  // against the previous hour's reading, just racing by however long the
  // `/weather/current/batch` request itself takes to come back (its own
  // delay, independent of and in addition to the 400ms debounce) instead of
  // by the debounce window. Same bug, smaller window, same visible symptom.
  // `towerAsOf` only ever updates in the same tick `observationsList`
  // (RTK Query's `currentData` - undefined until THIS exact `debouncedAt`'s
  // fetch has actually landed) changes, so the label and the data it
  // describes can never be torn apart again regardless of network/backend
  // latency. `ClusteredSiteMarkers` uses this instead of `debouncedAt` now.
  const [towerAsOf, setTowerAsOf] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (observationsList !== undefined) {
      setTowerAsOf(debouncedAt);
    }
  }, [observationsList, debouncedAt]);

  // A second, state-scoped-but-not-district-filtered (or, with no state
  // picked yet, nationwide) view of the sites - this is what drives the
  // district choropleth, since every district needs to be colored by its
  // own worst risk, not just whichever single district the dropdown
  // currently has selected.
  const { data: riskScopeSitesPage } = useListSitesQuery({ state: state ?? undefined, pageSize: SITE_PAGE_SIZE });
  const riskScopeSites = useMemo(() => riskScopeSitesPage?.items ?? [], [riskScopeSitesPage]);
  const riskScopeSiteIds = useMemo(() => riskScopeSites.map((s) => s.id), [riskScopeSites]);
  const riskScopeWeatherAvailable = riskScopeSiteIds.length > 0 && riskScopeSiteIds.length <= WEATHER_FETCH_LIMIT;

  // --- Nationwide district-aggregate path (added 2026-09-30) ---------------
  // The per-tower `riskScopeSites`/`useGetObservationsAtTimeQuery` pair above
  // is what nationwide (`state` unset) was ALWAYS using - fetch every one of
  // ~57,000 towers' latest reading, then average client-side. Confirmed
  // still stuck (color AND "As of" tooltip label both frozen since first
  // load) even after three rounds of backend tuning (query parallelization,
  // the hourly_weather composite index, a raised connection pool - see
  // claude/live-map-indus-connection-pool-increase.md and
  // claude/live-map-nationwide-timeline-lag-backend-fix.md). Rather than a
  // fourth tuning attempt at the SAME "fetch every tower" shape, this calls
  // the new GET /weather/district-aggregate endpoint instead - one SQL
  // GROUP BY, ~211 rows (real districts with any hourly_weather data),
  // regardless of nationwide tower count.
  //
  // Only used for the district/state CHOROPLETH (`stateRiskIndex`/
  // `districtRiskIndex` below) - `riskScopeSites`/`riskScopeObservations`
  // above are left completely unchanged for everything else that still
  // needs real per-tower data at real coordinates (WindFlowLayer's samples,
  // `resolveGeoDistricts`, the network panel), and for the state-selected
  // case, which already works correctly per-tower and stays on that path.
  // Only `currentData` is used - the nationwide DISTRICT-level choropleth
  // this query used to also gate (via `isError`) was removed 2026-09-30 per
  // explicit request ("if someone click or select the state then show
  // district boundaries not all nationwide" + "currently i fresh open the
  // live-map they show me pop-up of the district load data... remove this
  // and show me state boundaries with coloring") - see stateRiskIndex's own
  // FALLBACK comment below for what this query is still used for.
  const { currentData: districtAggregateList } = useGetDistrictAggregateQuery(
    { at: debouncedAt },
    { skip: !!state }
  );
  const nationwideAggKey = 'nationwide';
  const lastDistrictAggregateRef = useRef<{ key: string; list: DistrictWeatherAggregate[] } | null>(null);
  if (districtAggregateList !== undefined) {
    lastDistrictAggregateRef.current = { key: nationwideAggKey, list: districtAggregateList };
  }
  const effectiveDistrictAggregateList =
    districtAggregateList ??
    (lastDistrictAggregateRef.current?.key === nationwideAggKey ? lastDistrictAggregateRef.current.list : undefined);

  // One synthetic pseudo-`Site` per real district (no real lat/long - this
  // is an averaged reading, not one tower - so this is deliberately never
  // used for anything coordinate-based, only for buildStateRiskIndex/
  // buildDistrictRiskIndex below, which only ever read `.id`/`.state`/
  // `.district`).
  const nationwideAggSites = useMemo(() => {
    return (effectiveDistrictAggregateList ?? []).map(
      (row) =>
        ({
          id: row.observation.siteId,
          code: row.observation.siteId,
          name: row.district,
          circle: row.state,
          state: row.state,
          district: row.district,
          tehsil: '',
          latitude: 0,
          longitude: 0,
          address: '',
          status: 'ACTIVE',
          elevationMeters: 0,
          installedOn: '',
          contactPerson: '',
          contactPhone: '',
          towerType: 'Monopole',
        }) as unknown as Site
    );
  }, [effectiveDistrictAggregateList]);
  const nationwideAggObservations = useMemo(() => {
    const map: Record<string, CurrentObservation> = {};
    (effectiveDistrictAggregateList ?? []).forEach((row) => {
      map[row.observation.siteId] = row.observation;
    });
    return map;
  }, [effectiveDistrictAggregateList]);
  const [nationwideAggAsOf, setNationwideAggAsOf] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (districtAggregateList !== undefined) {
      setNationwideAggAsOf(debouncedAt);
    }
  }, [districtAggregateList, debouncedAt]);

  // Whether the fast ~211-row district-aggregate endpoint has actually
  // returned real rows yet - hoisted out of stateRiskIndex's own memo below
  // (2026-09-30, "in nationwide they not show pleas echeck") since the new
  // nationwide DISTRICT choropleth further down needs this exact same
  // readiness check too: nationwide only gets real per-district colors once
  // this is true, and otherwise stays on the coarser state-level view
  // (stateRiskIndex's own fallback) until the backend catches up - see that
  // memo's own "FALLBACK" comment for the full history.
  const nationwideDataReady = nationwideAggSites.length > 0;

  // Same `currentData`-not-`data` fix as `observationsList` above, and for
  // the same reason: this is the query that actually feeds the district/
  // state choropleth's fill color AND its hover tooltip reading
  // (districtRiskIndex/stateRiskIndex below both derive from
  // riskScopeObservations, which derives from this) - i.e. this is the
  // exact query behind both reported videos (Sagar and Kishtwar). Plain
  // `data` here is what was showing a real-but-stale earlier hour's average
  // while a newer hour's request was still in flight during scrubbing/
  // playback.
  const { currentData: riskScopeObservationsList } = useGetObservationsAtTimeQuery(
    { siteIds: riskScopeSiteIds, at: debouncedAt },
    { skip: !riskScopeWeatherAvailable }
  );

  // Same RETAIN-LAST-GOOD fallback as `observationsList` above, and for the
  // same reason (2026-09-25 Live Map presentation complaint) - this is the
  // query that actually feeds the district/state choropleth's fill color, so
  // this is the one responsible for "no data in Madhya Pradesh, large
  // numbers of districts, they load after some time coloring": every hour
  // change blanked EVERY district in scope to gray "no data" for as long as
  // this batch fetch was in flight, which scales with how many towers the
  // state has. Scoped to `state` alone (not `state`+`district`), matching
  // this query's own `useListSitesQuery({ state, pageSize })` above - this
  // view is never narrowed by `district`, so a district pick alone must not
  // discard the retained state-wide reading. `riskScopeAsOf` below is
  // unchanged, so the retained data and its displayed "As of" hour still
  // always describe the same real fetch together.
  const riskScopeKey = state ?? '';
  const lastRiskScopeObservationsRef = useRef<{ key: string; list: CurrentObservation[] } | null>(null);
  if (riskScopeObservationsList !== undefined) {
    lastRiskScopeObservationsRef.current = { key: riskScopeKey, list: riskScopeObservationsList };
  }
  const effectiveRiskScopeObservationsList =
    riskScopeObservationsList ??
    (lastRiskScopeObservationsRef.current?.key === riskScopeKey ? lastRiskScopeObservationsRef.current.list : undefined);

  // Also feeds the wind-flow overlay below, so the animated field has
  // samples spread across the whole visible region (not just whichever
  // single district the dropdown currently narrows `sites`/`observations`
  // down to).
  const riskScopeObservations = useMemo(() => {
    const map: Record<string, CurrentObservation> = {};
    (effectiveRiskScopeObservationsList ?? []).forEach((obs) => {
      map[obs.siteId] = obs;
    });
    return map;
  }, [effectiveRiskScopeObservationsList]);

  // Same "commit only once the data has actually landed" fix as `towerAsOf`
  // above, for the district/state choropleth's own query - see its doc
  // comment for the full explanation. This is the one that actually matters
  // for DistrictLayer/StateOutlinesLayer, since `riskScopeObservations` (not
  // `observations`) is what districtRiskIndex/stateRiskIndex - and so
  // riskFingerprint and the tooltip's avgValue - are built from.
  const [riskScopeAsOf, setRiskScopeAsOf] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (riskScopeObservationsList !== undefined) {
      setRiskScopeAsOf(debouncedAt);
    }
  }, [riskScopeObservationsList, debouncedAt]);

  // Surfaces a "still loading" popup specifically when THIS fetch (the one
  // that actually drives the district/state choropleth's color and hover
  // reading) is taking unusually long - added 2026-09-30 directly answering
  // "how would someone know... is there any loading pop show" during the
  // nationwide-timeline-lag investigation (see
  // claude/live-map-nationwide-timeline-lag-backend-fix.md): there was
  // previously NO visual signal at all for this specific fetch being slow -
  // the map just silently kept showing whatever it last had, with nothing
  // on screen to say whether that was because nothing had changed or
  // because a fetch was genuinely still stuck in flight. That silence is
  // exactly what made "is it loading, or is it broken?" impossible to tell
  // from the map alone.
  //
  // Deliberately NOT shown the instant a fetch starts, unlike the other two
  // signals `ProcessingOverlay` already covers (`showSitesSwitchingChip`,
  // `anyBoundaryLoading`) - this query re-fires on EVERY hourly tick
  // (`debouncedAt` is one of its args), and most of those resolve in well
  // under a second even at state scope. Showing a popup on every single
  // ordinary tick would reintroduce the exact flicker `riskScopeObservations`
  // own retain-last-good pattern (just above) was built to avoid (2026-09-25,
  // "this is not good for presentation"). So this only flips on after the
  // CURRENT fetch has been pending continuously for `SLOW_FETCH_MS` - long
  // enough that a normal, fast resolution never reaches it, but a
  // genuinely stuck/slow one (nationwide, before its backend query was sped
  // up - or any future regression) does. Resets the instant fresh data
  // lands (or the fetch is skipped), so it never lingers past whatever it's
  // reporting on.
  const riskScopeIsFetching = riskScopeObservationsList === undefined && riskScopeWeatherAvailable;
  const [showSlowRiskScopeFetch, setShowSlowRiskScopeFetch] = useState(false);
  useEffect(() => {
    if (!riskScopeIsFetching) {
      setShowSlowRiskScopeFetch(false);
      return;
    }
    const timer = window.setTimeout(() => setShowSlowRiskScopeFetch(true), SLOW_FETCH_MS);
    return () => window.clearTimeout(timer);
  }, [riskScopeIsFetching]);

  // Which hour-of-day the 7-day forecast panel below previews for every day
  // in the week - tied to the bottom timeline scrubber's own current hour
  // (hourOffset is a combined 0-167 day+hour index; % 24 gives the hour of
  // whichever day it's on) so dragging/playing that slider actually changes
  // the panel's numbers instead of leaving them frozen at a fixed noon
  // snapshot taken once when the panel first opened.
  const forecastSampleHour = timeline.hourOffset % 24;
  // Plain-English "3 PM" form of forecastSampleHour, shown in the forecast
  // panel's header so it's obvious *why* the numbers just changed after
  // dragging the scrubber, rather than looking like a random flicker.
  const forecastHourLabel = (() => {
    const period = forecastSampleHour < 12 ? 'AM' : 'PM';
    const twelveHour = forecastSampleHour % 12 === 0 ? 12 : forecastSampleHour % 12;
    return `${twelveHour} ${period}`;
  })();

  // Only fetched while the network Weather details panel (opened via the
  // (i) button) is actually open - skip is baked into useSevenDayObservations
  // itself (siteIds.length === 0), so passing an empty array while the
  // panel is closed avoids firing seven extra queries for nothing.
  const { days: networkDays } = useSevenDayObservations(
    showNetworkPanel ? riskScopeSiteIds : [],
    { sampleHour: forecastSampleHour }
  );
  // Same idea, scoped to the one district's sites (`siteIds` above is
  // already narrowed to state+district via useListSitesQuery) - powers the
  // district panel's own 7-day forecast section.
  const { days: districtDays } = useSevenDayObservations(
    showDistrictPanel ? siteIds : [],
    { sampleHour: forecastSampleHour }
  );

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

  // districtRiskIndex (per-district worst-risk color) is defined further
  // below, after `geoDistrictBySiteId` - it needs that geographic
  // resolution to be in scope, which in turn needs `districtBoundary`
  // (defined further down, once `constituentStates`/`getBoundary` exist).

  // One level coarser than districtRiskIndex below: a risk color per STATE
  // rather than per district, so the default (nothing-picked-yet) view -
  // StateOutlinesLayer, below - can show every state's own worst current
  // condition and visibly change color as the timeline's hourly/daily
  // slider moves, before drilling into any single state. `riskScopeSites`
  // is nationwide whenever `state` is unset (the only time this index is
  // actually rendered), so this naturally covers every state at once.
  const stateRiskIndex = useMemo(() => {
    // Nationwide (no state picked): the fast ~211-row district-aggregate
    // path (see its own comment above) instead of riskScopeSites'
    // ~57,000-tower fetch, which was confirmed to never land. State
    // selected: unchanged, still the real per-tower data.
    //
    // FALLBACK (added 2026-09-30, "visualizations colors is not showing
    // nationwide"): `nationwideAggSites` starts out (and stays) EMPTY until
    // GET /weather/district-aggregate actually returns rows - which it
    // never will if the backend hasn't been rebuilt/restarted with that new
    // endpoint yet (a 404 leaves `districtAggregateList` undefined forever,
    // same as any other RTK Query error - there is no automatic retry-until-
    // success). Before this fallback, that emptiness fed straight into
    // buildStateRiskIndex with nothing to fall back to, so nationwide's
    // choropleth silently went from "slow" to "completely blank" the moment
    // this endpoint was wired in - worse than the original bug. Falling
    // back to the old riskScopeSites/riskScopeObservations pair (the real
    // per-tower nationwide fetch, unchanged, still running in parallel for
    // WindFlowLayer/the network panel regardless) means nationwide always
    // shows SOMETHING - slow-but-correct until the new endpoint is live,
    // then automatically fast the moment it starts returning real rows.
    const sitesForIndex = state ? riskScopeSites : nationwideDataReady ? nationwideAggSites : riskScopeSites;
    const obsForIndex = state ? riskScopeObservations : nationwideDataReady ? nationwideAggObservations : riskScopeObservations;
    return buildStateRiskIndex(
      sitesForIndex,
      obsForIndex,
      (site, obs) => layerRisk(layer, obs, site),
      // layerGradientValue() here, not layerReading(...).value directly -
      // added 2026-09-29 alongside snowfall's new LAYER_GRADIENT_STOPS entry
      // (mapLayers.ts) - see that function's own doc comment for why:
      // layerReading substitutes a site's ELEVATION (meters) as a display
      // stand-in for snowfall/avalanche whenever no real snowfallCm exists,
      // which must never be graded/averaged as if it were centimeters of
      // snow. Every other layer's behavior is completely unchanged (this
      // just delegates straight through to layerReading for them).
      (site, obs) => layerGradientValue(layer, obs, site),
      layer === 'wind' ? (_site, obs) => obs.windDirection : undefined,
      layer === 'wind' ? (_site, obs) => obs.windGust : undefined
    );
  }, [state, riskScopeSites, riskScopeObservations, nationwideAggSites, nationwideAggObservations, nationwideDataReady, layer]);

  // Continuous fill color for a monitored district/state polygon, in place
  // of the flat 4-band `colors[risk]` fill - see colorForValue's own doc
  // comment for why: most real Indian weather sits inside the "none" band
  // for the whole week, so the discrete band color alone barely ever
  // changed as the timeline's hourly slider moved, even though the
  // underlying reading (now populated as `avgValue` via the `valueFn`
  // passed to buildDistrictRiskIndex/buildStateRiskIndex above) genuinely
  // was. Passed down to both DistrictLayer and StateOutlinesLayer so every
  // level of the choropleth (state outlines before drilling in, district
  // detail after) shades continuously the same way.
  const getFillColor = useCallback(
    (info: DistrictRiskInfo) => colorForValue(layer, LAYER_COLORS[layer], info.avgValue, info.risk),
    [layer]
  );

  // normalizeName(real state name) -> the actual raw Site.state (circle)
  // value to filter by, e.g. "Madhya Pradesh" AND "Chhattisgarh" both map to
  // "Madhya Pradesh & Chhattisgarh" - built straight from the site list
  // (never from observations, unlike stateRiskIndex's own sourceValue),
  // so clicking a state on the map or picking one from the dropdown always
  // resolves to a value real records actually carry, even when that state
  // currently has no live-observed reading. Only meaningful while `state`
  // is unset (riskScopeSites is nationwide exactly then - see its own
  // fetch above), which is exactly when it's needed (StateOutlinesLayer and
  // the State dropdown, both only relevant before/at the point of picking a
  // state).
  const stateSourceMap = useMemo(() => buildStateSourceMap(riskScopeSites), [riskScopeSites]);

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

  // Nationwide DISTRICT-level boundaries - added 2026-09-30, then REMOVED
  // the same day per a further explicit request ("if someone click or
  // select the state then show district boundaries not all nationwide" +
  // "currently i fresh open the live-map they show me pop-up of the
  // district load data... remove this and show me state boundaries with
  // coloring"). A day-wise Skymet-driven version of this (Today/Tomorrow,
  // colored from GET /weather/forecast/skymet/all) was later built and then
  // ALSO explicitly removed the same day ("remove this prompt changes
  // only" - reverting that whole request back out). The per-district
  // choropleth this fed (and the ~37-state boundary-file fetch + the
  // popup/timeline-hold that waited on it - see the old
  // `nationwideDistrictReady`/`nationwideDistrictPending`) is gone;
  // nationwide's default view is StateOutlinesLayer only now (state-level
  // color, from the fast `indiaStates` file plus `stateRiskIndex`'s own
  // FALLBACK below - no waiting, no popup). District-level boundaries/
  // coloring now only ever render once a specific state is picked
  // (`districtBoundary` above, already unaffected by any of this).

  // Resolves every in-scope tower's REAL district - by testing its actual
  // (latitude, longitude) against the government boundary polygons just
  // loaded above - instead of trusting each tower's own recorded `district`
  // text field. Added per explicit request: "Group towers by their actual
  // geographic location... District boundaries should be used as the
  // geographic reference, while the tower's coordinates determine which
  // district it actually belongs to. Do not let a tower's existing district
  // field override its actual map location... If 40-50 towers are
  // geographically in another district, they should appear in that other
  // district's circle/color, even if the source data currently says Patna."
  //
  // Deliberately NOT keyed on `districtBoundary.features` itself in the
  // deps array below - `useDistrictBoundariesForStates`'s own `get()`
  // returns a brand new function reference every render (see that hook's
  // source), so `districtBoundary` above is a fresh object every render too
  // even when its actual contents haven't changed - keying on it directly
  // would silently re-run this (and its interior point-in-polygon scan
  // across the whole state's real tower count) on every render, including
  // every hourly timeline tick. `districtBoundary.loading` flipping from
  // true to false, plus the feature count, is what actually signals "this
  // state's boundary data just finished loading" - the one moment this
  // genuinely needs to recompute, alongside the site list itself changing.
  const geoDistrictBySiteId = useMemo(() => {
    if (!districtBoundary || districtBoundary.loading || districtBoundary.features.length === 0) {
      return new Map<string, string>();
    }
    return resolveGeoDistricts(riskScopeSites, districtBoundary.features);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riskScopeSites, districtBoundary?.loading, districtBoundary?.features.length]);

  // Per-district worst-risk color, plus a real cross-site average of
  // whichever parameter is active (`info.avgValue`, via `valueFn` below) so
  // the hover tooltip can show an actual figure alongside the color, not
  // just severity (per the later, superseding "show district+state+
  // parameter+data" request - see DistrictLayer.tsx's own comment on this).
  // For the wind layer only, also passes `directionValueFn` so the tooltip
  // can show a real averaged wind DIRECTION next to the averaged speed, not
  // speed alone (added 2026-09-22 per "if i click the wind speed they do not
  // show me wind speed and direction data in mouse over"), and `gustValueFn`
  // so it can show a real averaged wind GUST as its own third row (added
  // 2026-09-22 per "i need seperate index of wing speed and directions and
  // gust") - `undefined` for both on every other layer, since only wind has
  // direction/gust readings to average.
  //
  // TWO SEPARATE INDICES as of 2026-09-30 - this used to be ONE shared index
  // fed to both DistrictLayer and DistrictHullLayer. Trusting the DB
  // `District` field (see `indusDistrictRiskIndex` below) fixed Sheohar in
  // the Indus/Towers hull view, but applying that SAME change here broke the
  // plain Live Map ("district has been show grey no data"): `DistrictLayer`
  // keys its real government-boundary polygons by `canonicalDistrictName()`
  // - the boundary FILE's own spelling (post-alias) - not by whatever a
  // tower's raw `site.district` text happens to say. Those two only matched
  // for every district before because `geoDistrictBySiteId` (this index's
  // `districtFor` below) resolves each tower geographically and returns that
  // SAME canonical boundary-file name - so switching this index to raw
  // `site.district` desynced it from almost every one of `DistrictLayer`'s
  // polygon keys at once (any district whose raw DB spelling doesn't happen
  // to equal its boundary-file spelling), turning it uniformly gray. This
  // index is restored to the original geography-based resolution and is used
  // ONLY by `DistrictLayer` now; `indusDistrictRiskIndex` below is the
  // DB-field-trusting one, used ONLY by `DistrictHullLayer`.
  //
  // DUAL-KEYED as of 2026-09-30, follow-up #7 ("they do not show me coloring
  // of sheohar bihar and ganderbal jammu kashmir why??? but they have data
  // in databases"). Direct coordinate testing (all live Sheohar/Ganderbal
  // towers against the real, shipped boundary polygons) confirmed this is
  // not a naming/alias problem: those towers' actual GPS points fall inside
  // a NEIGHBORING district's polygon (Sitamarhi/Muzaffarpur/Simdega for
  // Sheohar; overwhelmingly Srinagar for Ganderbal, whose shipped boundary
  // shape visibly bulges into real Ganderbal territory - see the project
  // doc for the rendered comparison). So Sheohar's and Ganderbal's own
  // polygons on `DistrictLayer` genuinely receive zero geo-resolved sites
  // and stay grey, even though both districts plainly have live data under
  // their own name in the DB.
  //
  // Rather than switch this index fully to raw `site.district` (already
  // tried once above and reverted - it desyncs from `DistrictLayer`'s
  // boundary-file-keyed polygons everywhere the DB spelling doesn't match
  // the boundary file's), each site is now counted under BOTH its
  // geography-resolved key AND its raw `site.district` key (via
  // `buildRiskIndex` directly, bypassing `buildDistrictRiskIndex`'s
  // single-key `districtFor` - see that function's own comment). This is
  // purely additive: a site whose two keys are the same (the normal case -
  // most towers) is only ever counted once, so every already-correct
  // district is completely unaffected; a site whose two keys differ now
  // ALSO counts toward its own raw-DB-named polygon (Sheohar, Ganderbal),
  // in addition to - not instead of - whichever neighboring polygon it
  // geo-resolves into. Nothing is removed from any district that already
  // worked. `indusDistrictRiskIndex`/`DistrictHullLayer` below are
  // untouched by this change, per "indus section working well do not touch
  // please".
  const districtRiskIndex = useMemo(() => {
    return buildRiskIndex(
      riskScopeSites,
      riskScopeObservations,
      (site, obs) => layerRisk(layer, obs, site),
      (site) => {
        const geoKey = geoDistrictBySiteId.get(site.id) ?? site.district;
        const rawKey = site.district;
        return normalizeName(geoKey) === normalizeName(rawKey) ? [geoKey] : [geoKey, rawKey];
      },
      // layerGradientValue() here, not layerReading(...).value directly -
      // added 2026-09-29 alongside snowfall's new LAYER_GRADIENT_STOPS entry
      // (mapLayers.ts) - see that function's own doc comment for why:
      // layerReading substitutes a site's ELEVATION (meters) as a display
      // stand-in for snowfall/avalanche whenever no real snowfallCm exists,
      // which must never be graded/averaged as if it were centimeters of
      // snow. Every other layer's behavior is completely unchanged (this
      // just delegates straight through to layerReading for them).
      (site, obs) => layerGradientValue(layer, obs, site),
      undefined,
      layer === 'wind' ? (_site, obs) => obs.windDirection : undefined,
      layer === 'wind' ? (_site, obs) => obs.windGust : undefined
    );
  }, [riskScopeSites, riskScopeObservations, layer, geoDistrictBySiteId]);

  // Indus/Towers hull view's own risk index - trusts each tower's raw stored
  // `site.district` field instead of its geography-resolved district.
  //
  // Added 2026-09-30 ("Sheohar shows no data/no coloring" - the same report
  // that originally motivated the geography-based index above): confirmed
  // via a live diagnostic and direct coordinate checks that Sheohar's own
  // three towers with a live reading (ids 343/4883/14145) geo-resolve to
  // three DIFFERENT other districts (Sitamarhi, Muzaffarpur, and - for one
  // tower whose recorded coordinates are 432km away, in a different state -
  // Simdega), none of them "Sheohar" itself. Under the geography-first rule,
  // every one of those towers' live readings counted toward a neighboring
  // district instead of Sheohar, so Sheohar's own risk-index entry was
  // genuinely empty (siteCount 0) even though its own indus_locations rows
  // plainly say "Sheohar" and do have live data. Explicitly asked the user
  // to choose between keeping pure geography (accepting this outcome for any
  // similarly small/distorted district) or trusting the recorded `District`
  // column for coloring instead; the user chose the latter ("Trust the DB's
  // District column for coloring... a tower's data counts toward whatever
  // district its own record says, regardless of where its GPS point
  // actually falls"). `districtFor` below is `site.district` - the raw
  // stored field, same as `DistrictHullLayer`'s own grouping uses (see that
  // file's matching comment) so a drawn hull and its fill color always agree
  // on which towers belong to it. Kept as its OWN index (not the one above)
  // after the plain-Live-Map regression this caused when it was shared - see
  // `districtRiskIndex`'s own comment for the full story.
  const indusDistrictRiskIndex = useMemo(() => {
    return buildDistrictRiskIndex(
      riskScopeSites,
      riskScopeObservations,
      (site, obs) => layerRisk(layer, obs, site),
      // layerGradientValue() here, not layerReading(...).value directly -
      // added 2026-09-29 alongside snowfall's new LAYER_GRADIENT_STOPS entry
      // (mapLayers.ts) - see that function's own doc comment for why:
      // layerReading substitutes a site's ELEVATION (meters) as a display
      // stand-in for snowfall/avalanche whenever no real snowfallCm exists,
      // which must never be graded/averaged as if it were centimeters of
      // snow. Every other layer's behavior is completely unchanged (this
      // just delegates straight through to layerReading for them).
      (site, obs) => layerGradientValue(layer, obs, site),
      layer === 'wind' ? (_site, obs) => obs.windDirection : undefined,
      layer === 'wind' ? (_site, obs) => obs.windGust : undefined,
      (site) => site.district
    );
  }, [riskScopeSites, riskScopeObservations, layer]);

  // (The nationwide DISTRICT-level risk index and its district-click handler
  // that used to live here were removed 2026-09-30 alongside the nationwide
  // DISTRICT choropleth itself - see `constituentStates`'s own comment
  // above for why.)

  const selectedStateFeatures = useMemo(() => {
    if (constituentStates.length === 0) return [];
    const wanted = new Set(constituentStates.map(normalizeName));
    return indiaStates.features.filter((f) => wanted.has(normalizeName(extractStateName(f) ?? '')));
  }, [indiaStates.features, constituentStates]);

  // Nationwide's only boundary-loading wait now is the one fast, once-per-tab
  // state-outline file (`indiaStates`) - simplified 2026-09-30 back to this
  // (from a three-phase state+district-data+district-file wait) when the
  // nationwide DISTRICT choropleth was removed; see `constituentStates`'s own
  // comment above for the full history.
  const anyBoundaryLoading = state ? !!districtBoundary?.loading : indiaStates.loading;
  const allBoundariesFailed = state
    ? !districtBoundary?.loading && (districtBoundary?.features.length ?? 0) === 0
    : !indiaStates.loading && indiaStates.error;

  // Combines this file's three genuine "processing" signals into the one
  // message `ProcessingOverlay` shows at a time (see that component's own
  // doc comment above) - `null` when none is happening, so the popup simply
  // isn't rendered. Priority order: a state/district switch's own
  // sites-still-fetching state wins over a boundary-polygon load (both can
  // be true at once right after a district pick, and the sites message is
  // the more specific of the two), and the slow-weather-fetch signal
  // (`showSlowRiskScopeFetch`, added 2026-09-30 - see its own doc comment
  // above) is checked last, since it only ever fires well after either of
  // the other two would already have resolved one way or another. The
  // static "boundaries unavailable" warning and the "showing X
  // boundaries"/"N towers shown" info chips further down are deliberately
  // NOT folded in here - those are persistent informational banners, not
  // transient loading states, so they stay put at the bottom as before.
  // Simplified back to a plain two-way label 2026-09-30 (nationwide back to
  // just "Loading state boundaries...", same as the state-drilldown case's
  // own "Loading district boundaries...") once the nationwide DISTRICT
  // choropleth this used to also cover was removed - see
  // `anyBoundaryLoading`'s own comment above.
  const processingLabel = showSitesSwitchingChip
    ? 'Loading...'
    : anyBoundaryLoading
      ? state
        ? 'Loading district boundaries...'
        : 'Loading state boundaries...'
      : showSlowRiskScopeFetch
        ? 'Loading weather data...'
        : null;

  // Added 2026-09-30 ("timeline running even loading... if loading show then
  // timeline stop after loading complete they start at same time"): freezes
  // the playback slider (`useMapTimeline`'s own `holdPlayback` - see its doc
  // comment) for exactly as long as `ProcessingOverlay` is showing, i.e. the
  // same three signals combined into `processingLabel` just above - a site-
  // list switch, a boundary-polygon load, or the slow-weather-fetch popup.
  // Deliberately keyed off the popup itself, not off `riskScopeIsFetching`/
  // `sitesIsFetching` directly, so "the slider is frozen" and "the popup says
  // why" are always the same signal from the user's point of view - one
  // never shows without the other.
  useEffect(() => {
    timeline.setHoldPlayback(!!processingLabel);
  }, [processingLabel, timeline.setHoldPlayback]);

  const handleSelectDistrict = (districtName: string, districtState: string) => {
    setState(districtState);
    setDistrict(districtName);
    setSelectedSite(null);
    setShowNetworkPanel(false);
    setShowDistrictPanel(true);
    // Snaps the hourly timeline back to its live/starting hour on every
    // district pick - added 2026-09-30 per explicit request ("if choose the
    // district also the timeline start from the starting"). Without this, a
    // newly-picked district's colors/tooltip could be read against whatever
    // hour the PREVIOUS district happened to be scrubbed/played to, with
    // nothing on screen to flag that it's a stale hour rather than "now".
    timeline.resetToLive();
  };

  // Clicking a STATE on the choropleth (not yet a specific district) only
  // narrows scope (`state`, which already filters `riskScopeSites`/
  // `riskScopeObservations` via the `useListSitesQuery({ state })` filter
  // above) - it does NOT open any Weather details panel. This briefly opened
  // the nationwide/state-scoped panel (2026-09-24) per an explicit request,
  // then that was reverted the same day per an explicit follow-up ("i select
  // state why they open weather details right side - remove this function
  // only applicable for district") - opening a panel, like the (i) button's
  // own visibility, is district-only now (see `handleSelectDistrict` and
  // `showInfoButton={Boolean(district)}` on `MapViewControls` below).
  const handleSelectState = (stateName: string) => {
    setState(stateName);
    setDistrict(null);
    setSelectedSite(null);
    setShowDistrictPanel(false);
    // Snaps the hourly timeline back to its live/starting hour on every state
    // pick too, not just a district pick - added 2026-09-29 per explicit
    // request ("if i change the state then timeline start from the
    // starting"). Same resetToLive() as handleSelectDistrict above; see that
    // function's own comment for why "starting" means minHourOffset (the
    // earliest hour with real, non-fallback data), not a fixed hour 0.
    // Without this, picking a new state while the timeline was scrubbed/
    // played forward left that new state's whole choropleth colored against
    // whatever stale hour the PREVIOUS state was left on.
    timeline.resetToLive();
  };

  // Wrappers for the REGION panel's own two search dropdowns
  // (MapControls.tsx) - added 2026-09-24 per explicit request ("if some
  // select district and click the district then they show weather details
  // okay"), extending the same fix state's map-click already got above to
  // BOTH search dropdowns, not just clicking a shape on the map. Before
  // this, MapControls called the raw `setState`/`setDistrict` setters
  // directly, which narrowed the map's scope and (for state) unhid the (i)
  // button via `Boolean(state)`, but never opened a panel - picking a
  // district from the dropdown was a silent no-op panel-wise, same dead
  // click the map-click fix addressed for state.
  //
  // Clearing a field (value null - the Autocomplete's own "x"/cross clear
  // control) still just narrows/widens scope with no panel side effect,
  // matching the dropdown's pre-existing clear behavior - but as of
  // 2026-09-29 ("if i cross the district and state then also timeline start
  // from the starting") it now ALSO resets the timeline, same as actually
  // picking a state/district does (see handleSelectState/handleSelectDistrict
  // above). Before this, clearing the State or District dropdown back to
  // "nothing picked" left the timeline sitting at whatever hour it had been
  // scrubbed/played to under the PREVIOUS selection - so the freshly-cleared,
  // wider-scoped view (state-wide, or nationwide) could still be read against
  // a stale hour, the same class of bug already fixed for the "pick
  // something new" direction.
  const handleChangeState = (stateName: string | null) => {
    if (stateName) {
      handleSelectState(stateName);
    } else {
      setState(null);
      setDistrict(null);
      setShowDistrictPanel(false);
      timeline.resetToLive();
    }
  };

  const handleChangeDistrict = (districtName: string | null) => {
    if (districtName && state) {
      handleSelectDistrict(districtName, state);
    } else {
      setDistrict(null);
      setShowDistrictPanel(false);
      timeline.resetToLive();
    }
  };

  // Any one Weather details panel (per-tower, nationwide, or per-district)
  // occupies the right edge of the map when open, so the top-right view
  // controls and the legend shift left by its width instead of being
  // covered by it. All three are mutually exclusive (see
  // handleSelectSite/handleOpenInfo/handleSelectDistrict).
  const rightControlOffset =
    selectedSite || showNetworkPanel || showDistrictPanel ? WEATHER_DETAILS_PANEL_WIDTH + 24 : 12;

  // Clicking a tower now opens the SAME district-scoped panel as clicking a
  // district boundary directly (handleSelectDistrict), rather than a
  // single-tower-only readout - per explicit request, a tower click should
  // show that tower's district's data, not just the one point clicked.
  // `site.state` is always the real raw DB circle value already (there's no
  // fallback/matching needed the way there is for a map-boundary click -
  // see buildStateSourceMap's doc comment - since it comes straight off the
  // site record itself), so this also naturally drills the map into the
  // correct district/state boundary for that tower.
  const handleSelectSite = (site: Site) => {
    setShowNetworkPanel(false);
    setSelectedSite(null);
    setState(site.state);
    setDistrict(site.district);
    setShowDistrictPanel(true);
  };

  const handleOpenInfo = () => {
    setSelectedSite(null);
    setShowDistrictPanel(false);
    setShowNetworkPanel(true);
  };

  // Only the true first (bootstrap) load blanks the whole page now - see
  // `hasLoadedSitesOnceRef`'s own doc comment above for why. Every later
  // state/district switch instead falls through to render as normal, with
  // the small "Loading..." chip (`showSitesSwitchingChip`, below) covering
  // the "something's fetching" signal without hiding the map/timeline.
  if (sitesLoading && !hasLoadedSitesOnceRef.current) return <LoadingState label="Loading tower network..." />;
  if (sitesError) return <ErrorState title="Failed to load sites" onRetry={refetch} />;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <DemoModeTicker />
      <Box ref={mapWrapperRef} sx={{ position: 'relative', flex: 1, minHeight: 0 }}>
      <MapContainer
        center={INDIA_CENTER}
        zoom={INDIA_ZOOM}
        minZoom={4}
        // Removed the bottom-right "Leaflet | © OpenStreetMap contributors"
        // attribution control per explicit request - Leaflet renders this
        // by default (the "Leaflet" prefix plus each TileLayer's own
        // `attribution` string, still passed below and otherwise unused
        // now that the control itself is gone).
        attributionControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          key={basemap}
          url={TILE_LAYERS[basemap].url}
          attribution={TILE_LAYERS[basemap].attribution}
        />
        <IndiaBoundaryOutline />
        <ResetToIndiaView state={state} />
        {/* Nationwide default view - STATE-level color only. Widened
            2026-09-30 to a full per-district choropleth twice (once on the
            slow hourly district-aggregate endpoint, once on the fast Skymet
            day-wise feed), and both times explicitly reverted back out the
            same day ("if someone click or select the state then show
            district boundaries not all nationwide" the first time; "remove
            this prompt changes only" the second time). District-level
            boundaries/coloring are drilldown-only now (see the
            state-selected block further down) - nationwide shows this one
            layer, unconditionally the moment the fast `indiaStates` file
            and `stateRiskIndex` are ready, with no popup and no wait on any
            per-district endpoint at all. */}
        {!state && visibleStateFeatures.length > 0 && (
          <StateOutlinesLayer
            features={visibleStateFeatures}
            onSelectState={handleSelectState}
            stateRisk={stateRiskIndex}
            colors={LAYER_COLORS[layer]}
            layer={layer}
            stateSourceMap={stateSourceMap}
            getFillColor={getFillColor}
            // The district-aggregate query's own "As of" when it's ready
            // (stateRiskIndex's own FALLBACK swaps in nationwideAggSites the
            // same way once that fast endpoint returns), else the old
            // riskScopeAsOf - see stateRiskIndex's own "FALLBACK" comment.
            asOf={nationwideAggAsOf ?? riskScopeAsOf}
          />
        )}
        {state && districtBoundary && districtBoundary.features.length > 0 && (
          <>
            {/* Indus/Towers view: the real government district boundary is
                replaced entirely by a shape connecting each district's own
                towers' coordinates - per explicit request ("Replace it
                everywhere in the Indus/Towers view - the real boundary line
                is gone from that view entirely, and each district is
                instead drawn as the hull of its own towers' coordinates...
                accepting that it won't match the true district shape").
                Outside this toggle, DistrictLayer keeps drawing the real
                Survey-of-India boundary unchanged - this replacement is
                scoped to the Indus/Towers view only. The enclosing state's
                own outline (StateBoundaryLayer, below) is a different,
                non-interactive context line and was left unchanged either
                way - only the district-level shape was asked to change. */}
            {showTowers ? (
              <DistrictHullLayer
                stateName={state}
                sites={riskScopeSites}
                districtRisk={indusDistrictRiskIndex}
                colors={LAYER_COLORS[layer]}
                layer={layer}
                selectedDistrict={district}
                onSelectDistrict={handleSelectDistrict}
                enableFitBounds
                getFillColor={getFillColor}
                asOf={riskScopeAsOf}
                // No longer passed geoDistrictBySiteId as of 2026-10-03 - see
                // DistrictHullLayer.tsx's own header/groups-memo comments:
                // per explicit instruction, a district's hull shape is no
                // longer geography-exclusion-filtered at all, so this prop
                // (added 2026-10-01 for the Kargil case) is unused here now.
                // The same map is still passed to ClusteredSiteMarkers below,
                // for each tower's own marker label - a separate, unaffected
                // use of it.
              />
            ) : (
              <DistrictLayer
                stateName={state}
                features={districtBoundary.features}
                districtRisk={districtRiskIndex}
                colors={LAYER_COLORS[layer]}
                layer={layer}
                selectedDistrict={district}
                onSelectDistrict={handleSelectDistrict}
                enableFitBounds
                getFillColor={getFillColor}
                asOf={riskScopeAsOf}
              />
            )}
            <StateBoundaryLayer stateName={state} features={selectedStateFeatures} />
          </>
        )}
        {showTowers && (
          <ClusteredSiteMarkers
            sites={sites}
            observations={observations}
            layer={layer}
            onSelectSite={handleSelectSite}
            asOf={towerAsOf}
            geoDistrictBySiteId={geoDistrictBySiteId}
          />
        )}
        <WindFlowLayer
          sites={riskScopeSites}
          observations={riskScopeObservations}
          enabled={showWind}
          boundaryFeatures={state ? selectedStateFeatures : undefined}
        />
      </MapContainer>

      {/* Centered "processing" popup - see ProcessingOverlay's own doc
          comment above for why this replaced the old bottom-pinned chip
          pair (added 2026-09-30, "if there is processing show they show
          loading... pop in the map"; moved to the middle and restyled
          2026-09-29 per the follow-up "map loading anything is processing
          background in live map they middle show of the loading.. pop up
          with professional way"). Still fires only on a genuine state/
          district SWITCH or a boundary-polygon load (see `processingLabel`
          above for exactly which) - never during ordinary hourly scrubbing/
          playback, so it does not regress the deliberate retain-last-good
          anti-flicker behavior used for the observations queries elsewhere
          in this file. */}
      {processingLabel && <ProcessingOverlay label={processingLabel} />}
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
      <ParameterToolbar layer={layer} onChangeLayer={handleChangeLayer} />
      <MapControls
        state={state}
        onChangeState={handleChangeState}
        district={district}
        onChangeDistrict={handleChangeDistrict}
        stateOptions={stateOptions}
        stateSourceMap={stateSourceMap}
      />
      <MapViewControls
        basemap={basemap}
        onChangeBasemap={handleChangeBasemap}
        showTowers={showTowers}
        onToggleTowers={handleToggleTowers}
        // Indus switch itself is hidden nationwide - see the `showTowers`
        // doc comment above for why (this used to just default off, which
        // still let a user flip it on nationwide and trigger a full-tower
        // fetch; hiding the control removes that path entirely).
        showTowersToggle={Boolean(state)}
        onOpenInfo={handleOpenInfo}
        // Corrected 2026-09-24 per explicit follow-up ("not in state select
        // and without state. only applicable this button district") - this
        // was gated on `Boolean(state)`, which unhid the button as soon as
        // ANY state was picked (dropdown or map click), before a specific
        // district was ever chosen. The button should stay hidden through a
        // bare state selection and only appear once a DISTRICT has been
        // selected (clicking a district on the map, the district search
        // dropdown, or a tower click - all of which set `district`, never
        // just `state` alone).
        showInfoButton={Boolean(district)}
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
          forecastHourLabel={forecastHourLabel}
          onClose={() => setShowNetworkPanel(false)}
        />
      )}
      {showDistrictPanel && district && (
        <NetworkWeatherPanel
          sites={sites}
          observations={districtObservations}
          days={districtDays}
          forecastHourLabel={forecastHourLabel}
          onClose={() => setShowDistrictPanel(false)}
          title={district}
          location={state ?? ''}
          skymetScope={state ? { district, state } : undefined}
        />
      )}
      {/* Anchors the timeline scrubber at the bottom of the map, same
          position it held on its own Paper before 2026-09-28 (see
          TimelineScrubber.tsx's own comment on why that positioning moved
          here) - now shared with IndusHullTicker so the two stack in one
          column regardless of either one's own height, instead of two
          separately-positioned absolute elements with a guessed-at gap.
          Hidden together on mobile, matching TimelineScrubber's own
          pre-existing `display: { xs: 'none', md: 'block' }` (kept on its
          Paper too, so nothing regresses if this wrapper's condition and
          that one ever drift apart). */}
      <Box
        sx={{
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 12,
          zIndex: 1000,
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          gap: 1,
        }}
      >
        {/* Not explicitly requested, but shown only in the Indus/Towers hull
            view so it doesn't look like it's showing the real (Survey-of-
            India) district boundary it's actually replacing - flags the
            shape as tower-derived and approximate, matching this app's
            existing care around not misrepresenting official boundary data
            (see districtGeo.ts's government-boundary provenance notes).
            Changed from a plain Chip to this scrolling ticker per explicit
            request ("change this is ticker type above timeline like"). Easy
            to remove if unwanted. */}
        {showTowers && state && districtBoundary && districtBoundary.features.length > 0 && <IndusHullTicker />}
        {/* Nationwide has NO timeline scrubber at all. A Skymet-driven
            Today/Tomorrow day-wise district choropleth (with its own
            day-picker - first a ToggleButtonGroup, then a reused
            TimelineScrubber daily-mode slider) was built here 2026-09-30 per
            an explicit request, then the whole thing was explicitly reverted
            back out the same day ("remove this prompt changes only" -
            quoting that original request back). Nationwide is back to the
            plain state-level StateOutlinesLayer view above, with no day
            concept and no scrubber of any kind. The hourly scrubber below is
            unchanged and still only renders once a state is picked. */}
        {state && (
          <TimelineScrubber
            mode={timeline.mode}
            onChangeMode={timeline.setMode}
            days={timeline.days}
            dayOffset={timeline.dayOffset}
            onChangeOffset={timeline.setDayOffset}
            hours={timeline.hours}
            hourOffset={timeline.hourOffset}
            onChangeHourOffset={timeline.setHourOffset}
            minHourOffset={timeline.minHourOffset}
            playing={timeline.playing}
            onTogglePlaying={timeline.togglePlaying}
            speed={timeline.speed}
            onChangeSpeed={timeline.setSpeed}
          />
        )}
      </Box>
      </Box>
    </Box>
  );
}
