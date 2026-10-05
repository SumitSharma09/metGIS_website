import { Fragment, useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { MapContainer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { buildDistrictRiskIndex, normalizeName, splitCircleStateName } from '@/utils/districtRisk';
import { RISK_COLOR, NO_DATA_COLOR, REPORT_RISK_LABEL, type RiskLevel } from '@/utils/severity';
import { IndiaBoundaryOutline } from '@/pages/live-map/components/IndiaBoundaryOutline';
import { DistrictLayer } from '@/pages/live-map/components/DistrictLayer';
import { StateBoundaryLayer } from '@/pages/live-map/components/StateBoundaryLayer';
import { useDistrictBoundariesForStates, useIndiaStates, useVisibleStates } from '@/pages/live-map/useDistrictBoundaries';
import { extractStateName } from '@/pages/live-map/districtGeo';
import { INDIA_OUTLINE_GEOJSON } from '@/pages/live-map/indiaOutlineGeo';
import { computeOverallRisk } from '../riskAggregation';
import type { Site } from '@/features/sites/types';
import type { CurrentObservation } from '@/features/weather/types';
import type { ForecastDaySnapshot } from '../useSevenDayObservations';

const INDIA_CENTER: [number, number] = [22.9734, 78.6569];

// Computed once from the same Survey-of-India outline drawn on the map, so
// the "locked to India" bounds always agree with what's actually rendered.
// Padded outward slightly (rather than the exact coastline box) so the
// outline/districts never touch the very edge of the panel.
const INDIA_BOUNDS = L.geoJSON(INDIA_OUTLINE_GEOJSON).getBounds().pad(0.08);

// This is a report view, not a navigable street/satellite map - the
// reference product renders it as a flat, self-contained country shape, not
// a georeferenced basemap you can pan out of to see the rest of the world.
// Dropping the tile layer (and locking pan/zoom to India's own bounds)
// matches that: no neighboring-country tiles, place labels, or ocean
// clutter, just the outline and district polygons on the app's own dark
// background.
const MAP_BACKGROUND = '#0b1223';

// Same four bands as the Live Map legend / RegionalHeatmap table, just in the
// "Normal -> Extreme" report vocabulary instead of "No warning -> Warning".
const LEGEND_ORDER: RiskLevel[] = ['warning', 'alert', 'watch', 'none'];

interface RegionRiskMapProps {
  /** State-scoped (or, with no state picked, nationwide) sites - deliberately
   *  NOT narrowed to the selected district, so every district in view still
   *  gets its own worst-risk color instead of only the one the dropdown has
   *  picked (same reasoning as Live Map's `riskScopeSites`). */
  sites: Site[];
  /** Seven daily snapshots for those same sites - the map colors exactly one
   *  of these at a time (picked via the day toggle below), while the table
   *  above it keeps showing all seven days side by side. */
  days: ForecastDaySnapshot[];
  state: string | null;
  district: string | null;
  /** Clicking a district on the map drives the same State/District filters
   *  the Autocompletes above use, so the two stay in sync either way. */
  onSelectDistrict: (districtName: string, stateName: string) => void;
  /** Resets whatever State/District the map click (or the page's own
   *  Autocompletes) currently has selected, back to the nationwide view.
   *  Rendered as a small back/close chip overlaid directly on the map -
   *  added per explicit report: after clicking a district here, there was no
   *  visible "previous"/close control to get back out to "All India" short
   *  of hunting for the (hover-only) clear icon on the Autocompletes above
   *  the map. Optional so this component still works for any caller that
   *  doesn't want the affordance. */
  onClearSelection?: () => void;
}

/**
 * The Reports page's geographic counterpart to `RegionalHeatmap`'s table:
 * an actual Leaflet map with district boundary outlines and the national
 * outline highlighted, colored by worst overall tower risk - matching the
 * reference product's "Region Map" view (district shapes + state names +
 * a Normal/Moderate/High/Extreme/No-data legend), which a plain data table
 * can't show on its own.
 *
 * Reuses the Live Map's own boundary-fetching and choropleth-rendering
 * building blocks (`IndiaBoundaryOutline`, `DistrictLayer`,
 * `useDistrictBoundariesForStates`) rather than re-implementing them, so
 * both pages agree on district names, aliases, and risk coloring.
 */
export function RegionRiskMap({ sites, days, state, district, onSelectDistrict, onClearSelection }: RegionRiskMapProps) {
  const [dayOffset, setDayOffset] = useState(0);

  // Every government-recognized state/UT the signed-in user is RBAC-allowed
  // to see (Jammu and Kashmir/Ladakh/Arunachal Pradesh included) - the
  // Pan-India default view (no `state` picked) used to iterate
  // `useListStatesQuery()`'s site-derived list instead, which skipped any
  // state/UT with zero monitored demo sites entirely, not just left it
  // uncolored. See `useVisibleStates()`'s own doc comment.
  const { names: allStates } = useVisibleStates();
  // `state` here is the raw DB Site.state value (a telecom circle, e.g.
  // "Bihar & Jharkhand" for a combined circle) - district boundary files
  // only exist per real government state (bihar.json, jharkhand.json, never
  // a combined "bihar-jharkhand.json"), so a combined circle needs BOTH
  // split out and fetched, exactly like LiveMapPage's own `constituentStates`.
  // Left unsplit, useDistrictBoundariesForStates tried to fetch a boundary
  // keyed by the whole combined string, which never matches any real file -
  // getBoundary() then always returned zero features for that circle, and
  // the render loop below silently skipped it (no DistrictLayer, no colors,
  // no state outline) rather than erroring, so the map just looked empty
  // for any state that's actually a combined circle.
  const targetStates = useMemo(() => (state ? splitCircleStateName(state) : allStates), [state, allStates]);
  const { get: getBoundary } = useDistrictBoundariesForStates(targetStates);
  const indiaStates = useIndiaStates();

  const selectedDay = days.find((d) => d.offset === dayOffset) ?? days[0];

  const observationsById = useMemo(() => {
    const map: Record<string, CurrentObservation> = {};
    (selectedDay?.observations ?? []).forEach((obs) => {
      map[obs.siteId] = obs;
    });
    return map;
  }, [selectedDay]);

  const districtRiskIndex = useMemo(
    () => buildDistrictRiskIndex(sites, observationsById, (_site, obs) => computeOverallRisk(obs)),
    [sites, observationsById]
  );

  const boundaryStatuses = targetStates.map((s) => getBoundary(s));
  const anyBoundaryLoading = boundaryStatuses.some((s) => s.loading);
  const totalBoundaryFeatures = boundaryStatuses.reduce((n, s) => n + s.features.length, 0);
  const allBoundariesFailed =
    targetStates.length > 0 && boundaryStatuses.every((s) => !s.loading) && totalBoundaryFeatures === 0;

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        rowGap={1}
        sx={{ px: 1.5, py: 1 }}
      >
        <Typography variant="caption" color="text.secondary">
          Worst overall risk per district &middot; {state ?? 'All India'}
        </Typography>
        {days.length > 0 && (
          <ToggleButtonGroup
            size="small"
            value={dayOffset}
            exclusive
            onChange={(_e, v) => v !== null && setDayOffset(v)}
          >
            {days.map((d) => (
              <ToggleButton key={d.offset} value={d.offset} sx={{ px: 1.25, fontSize: 11 }}>
                {d.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}
      </Stack>

      <Box sx={{ position: 'relative', height: 460 }}>
        <MapContainer
          center={INDIA_CENTER}
          zoom={5}
          minZoom={4}
          maxZoom={10}
          maxBounds={INDIA_BOUNDS}
          maxBoundsViscosity={1}
          attributionControl={false}
          style={{ height: '100%', width: '100%', background: MAP_BACKGROUND }}
        >
          <IndiaBoundaryOutline />
          {/* No state drilled into yet: fit to India's own outline, since
              with no tile layer the default center/zoom otherwise leaves
              the map looking under- or over-cropped depending on panel
              size. Once a single state is picked, DistrictLayer's own
              `enableFitBounds` takes over and flies to that state instead. */}
          {targetStates.length !== 1 && <FitIndiaBounds />}
          {targetStates.map((s) => {
            const { features } = getBoundary(s);
            if (features.length === 0) return null;
            const stateFeature =
              indiaStates.features.find((f) => normalizeName(extractStateName(f) ?? '') === normalizeName(s)) ??
              null;
            return (
              <Fragment key={s}>
                <DistrictLayer
                  stateName={s}
                  features={features}
                  districtRisk={districtRiskIndex}
                  selectedDistrict={district}
                  onSelectDistrict={onSelectDistrict}
                  enableFitBounds={targetStates.length === 1}
                />
                <StateBoundaryLayer stateName={s} features={stateFeature ? [stateFeature] : []} />
              </Fragment>
            );
          })}
        </MapContainer>

        {/* Back/close control - appears the instant a district (or state) is
            in scope, whether that happened via a map click or the page's own
            Autocompletes, and clears it back to the nationwide view. See the
            prop's own doc comment above for why this was added. */}
        {state && onClearSelection && (
          <Chip
            icon={<ArrowBackRoundedIcon fontSize="small" />}
            deleteIcon={<CloseRoundedIcon fontSize="small" />}
            onDelete={onClearSelection}
            onClick={onClearSelection}
            label={district ? `${district}, ${state}` : state}
            size="small"
            sx={{ position: 'absolute', top: 12, left: 12, zIndex: 1000, bgcolor: 'background.paper', cursor: 'pointer' }}
          />
        )}

        {anyBoundaryLoading && (
          <Chip
            label="Loading district boundaries..."
            size="small"
            sx={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}
          />
        )}
        {!anyBoundaryLoading && allBoundariesFailed && (
          <Chip
            label="District boundaries unavailable - showing table view only"
            size="small"
            color="warning"
            sx={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}
          />
        )}

        <Paper
          elevation={2}
          sx={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            zIndex: 1000,
            px: 1.25,
            py: 0.75,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.25,
            alignItems: 'center',
            maxWidth: { xs: 200, sm: 'none' },
          }}
        >
          {LEGEND_ORDER.map((level) => (
            <Stack key={level} direction="row" spacing={0.5} alignItems="center">
              <Box sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: RISK_COLOR[level] }} />
              <Typography variant="caption">{REPORT_RISK_LABEL[level]}</Typography>
            </Stack>
          ))}
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Box sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: NO_DATA_COLOR }} />
            <Typography variant="caption">No data</Typography>
          </Stack>
        </Paper>
      </Box>
    </Paper>
  );
}

/** Frames the whole India outline on mount - the "All India" counterpart to
 *  DistrictLayer's own per-state `FitBoundsToState`, which only fires once a
 *  single state is selected. */
function FitIndiaBounds() {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(INDIA_BOUNDS, { padding: [8, 8] });
    // Runs once per mount - this map instance only exists while the "All
    // India" view is showing (targetStates.length !== 1 unmounts it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
