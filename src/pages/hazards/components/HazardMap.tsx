import { Fragment, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Site } from '@/features/sites/types';
import type { CurrentObservation } from '@/features/weather/types';
import { buildDistrictRiskIndex, normalizeName, splitCircleStateName, type DistrictRiskInfo } from '@/utils/districtRisk';
import { RiskLegend } from '@/pages/live-map/components/RiskLegend';
import { DistrictLayer } from '@/pages/live-map/components/DistrictLayer';
import { StateBoundaryLayer } from '@/pages/live-map/components/StateBoundaryLayer';
import { IndiaBoundaryOutline } from '@/pages/live-map/components/IndiaBoundaryOutline';
import { useDistrictBoundariesForStates, useIndiaStates, useVisibleStates } from '@/pages/live-map/useDistrictBoundaries';
import { extractStateName } from '@/pages/live-map/districtGeo';
import { LAYER_COLORS, layerRisk, type MapLayer } from '@/pages/live-map/mapLayers';
import { getFloodRisk, type CycloneSystem } from '../hazardData';
import { HazardToolbar, type HazardLayer } from './HazardToolbar';
import { CycloneTrackLayer } from './CycloneTrackLayer';
import { CycloneLegend } from './CycloneLegend';
import { CycloneSummary } from './CycloneSummary';

const INDIA_CENTER: [number, number] = [22.9734, 78.6569];

// The three district-choropleth hazards each just reuse one of the Live
// Map's own MapLayer color families/legends - Flood has no separate hazard
// palette of its own (flood risk *is* rainfall risk, see hazardData.ts's
// getFloodRisk), so it borrows Rainfall's blue scale, exactly like the old
// standalone FloodMap did.
const CHOROPLETH_LAYER: Record<Exclude<HazardLayer, 'cyclone'>, MapLayer> = {
  lightning: 'lightning',
  avalanche: 'avalanche',
  fog: 'fog',
  flood: 'rainfall',
};

const LEGEND_TITLE: Record<Exclude<HazardLayer, 'cyclone'>, string> = {
  lightning: 'Lightning Risk',
  avalanche: 'Avalanche Risk',
  fog: 'Fog Risk',
  flood: 'Flood Risk',
};

interface HazardMapProps {
  sites: Site[];
  observations: Record<string, CurrentObservation>;
  /** `null` while there's no real, live cyclone system (see
   *  hazardData.ts's getActiveCyclone) - the Cyclone toggle still exists,
   *  it just shows an honest "no live data" state instead of a fabricated
   *  track. */
  cyclone: CycloneSystem | null;
}

/**
 * One map, one parameter toolbar, for every hazard this app tracks -
 * Lightning, Flood, Avalanche, Fog and Cyclone - mirroring exactly how the
 * Live Map itself works (a single MapContainer with `ParameterToolbar`
 * switching what's drawn on it) instead of a separate small map per hazard
 * (the old standalone CycloneMap/FloodMap). The four district-level hazards
 * reuse the same real district-boundary choropleth machinery the Live Map
 * uses, just colored by their own risk function; Cyclone swaps in the storm
 * track layer instead, since a moving system isn't a per-district reading.
 */
export function HazardMap({ sites, observations, cyclone }: HazardMapProps) {
  const [hazardLayer, setHazardLayer] = useState<HazardLayer>('lightning');

  // `useVisibleStates().names` is the raw DB `Site.state` value - for this
  // deployment that's a telecom CIRCLE, e.g. "Bihar & Jharkhand", which
  // spans two real government states at once. District-boundary files and
  // the state-outline dataset only exist per real state (bihar.json,
  // jharkhand.json - never a combined "bihar-jharkhand.json"), so a combined
  // circle needs splitting before either lookup - exactly the same fix
  // already applied to LiveMapPage's `constituentStates` and RegionRiskMap's
  // `targetStates`. Left unsplit (as the old standalone FloodMap did),
  // `getBoundary()` never matches any real file for a combined circle -
  // every district/state boundary for it silently renders nothing, which is
  // what made most or all of the map look empty here.
  const { names: visibleCircles } = useVisibleStates();
  const targetStates = useMemo(
    () => Array.from(new Set(visibleCircles.flatMap((c) => splitCircleStateName(c)))),
    [visibleCircles]
  );
  const { get: getBoundary } = useDistrictBoundariesForStates(targetStates);
  const indiaStates = useIndiaStates();

  const riskIndex = useMemo<Map<string, DistrictRiskInfo>>(() => {
    if (hazardLayer === 'cyclone') return new Map();
    const riskFn =
      hazardLayer === 'flood'
        ? getFloodRisk
        : (site: Site, obs: CurrentObservation) => layerRisk(hazardLayer, obs, site);
    return buildDistrictRiskIndex(sites, observations, riskFn);
  }, [sites, observations, hazardLayer]);

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ height: 560 }}>
          <MapContainer center={INDIA_CENTER} zoom={5} minZoom={4} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            <IndiaBoundaryOutline />
            {hazardLayer === 'cyclone' ? (
              cyclone && <CycloneTrackLayer cyclone={cyclone} />
            ) : (
              targetStates.map((s) => {
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
                      districtRisk={riskIndex}
                      colors={LAYER_COLORS[CHOROPLETH_LAYER[hazardLayer]]}
                      selectedDistrict={null}
                      onSelectDistrict={() => {}}
                      enableFitBounds={false}
                    />
                    <StateBoundaryLayer stateName={s} features={stateFeature ? [stateFeature] : []} />
                  </Fragment>
                );
              })
            )}
          </MapContainer>
        </Box>

        <HazardToolbar layer={hazardLayer} onChangeLayer={setHazardLayer} />

        {hazardLayer === 'cyclone' ? (
          cyclone && <CycloneLegend />
        ) : (
          <RiskLegend layer={CHOROPLETH_LAYER[hazardLayer]} title={LEGEND_TITLE[hazardLayer]} />
        )}

        {hazardLayer === 'cyclone' && !cyclone && (
          <Chip
            label="No live cyclone advisory right now - awaiting a real IMD/JTWC feed"
            size="small"
            sx={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}
          />
        )}
      </Paper>

      {hazardLayer === 'cyclone' && cyclone && <CycloneSummary cyclone={cyclone} />}
    </Stack>
  );
}
