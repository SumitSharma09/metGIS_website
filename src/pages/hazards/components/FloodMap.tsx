import { Fragment, useMemo } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Site } from '@/features/sites/types';
import type { CurrentObservation } from '@/features/weather/types';
import { buildDistrictRiskIndex, normalizeName } from '@/utils/districtRisk';
import { RiskLegend } from '@/pages/live-map/components/RiskLegend';
import { DistrictLayer } from '@/pages/live-map/components/DistrictLayer';
import { StateBoundaryLayer } from '@/pages/live-map/components/StateBoundaryLayer';
import { IndiaBoundaryOutline } from '@/pages/live-map/components/IndiaBoundaryOutline';
import { useDistrictBoundariesForStates, useIndiaStates, useVisibleStates } from '@/pages/live-map/useDistrictBoundaries';
import { extractStateName } from '@/pages/live-map/districtGeo';
import { LAYER_COLORS } from '@/pages/live-map/mapLayers';
import { getFloodRisk } from '../hazardData';

const INDIA_CENTER: [number, number] = [22.9734, 78.6569];

interface FloodMapProps {
  sites: Site[];
  observations: Record<string, CurrentObservation>;
}

/** Flood risk has no separate hydrological model - it's derived from
 *  rainfall (see hazardData.ts's getFloodRisk) and rendered on the same
 *  real district-boundary choropleth machinery the Live Map uses, just
 *  colored by a different risk function. */
export function FloodMap({ sites, observations }: FloodMapProps) {
  // Every government-recognized state/UT the signed-in user is RBAC-allowed
  // to see (Jammu and Kashmir/Ladakh/Arunachal Pradesh included, whether or
  // not they have a monitored site yet) - this used to be `useListStatesQuery()`,
  // the site-derived list, which meant a state/UT with zero demo towers
  // (all three of those) never had its district boundaries fetched or drawn
  // on this map at all, not just left uncolored. See useVisibleStates()'s
  // own doc comment for the full story.
  const { names: allStates } = useVisibleStates();
  const { get: getBoundary } = useDistrictBoundariesForStates(allStates);
  const indiaStates = useIndiaStates();

  const floodRiskIndex = useMemo(() => buildDistrictRiskIndex(sites, observations, getFloodRisk), [sites, observations]);

  return (
    <Paper variant="outlined" sx={{ position: 'relative', overflow: 'hidden' }}>
      <Box sx={{ height: 480 }}>
        <MapContainer center={INDIA_CENTER} zoom={5} minZoom={4} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
          <IndiaBoundaryOutline />
          {allStates.map((s) => {
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
                  districtRisk={floodRiskIndex}
                  colors={LAYER_COLORS.rainfall}
                  selectedDistrict={null}
                  onSelectDistrict={() => {}}
                  enableFitBounds={false}
                />
                <StateBoundaryLayer stateName={s} features={stateFeature ? [stateFeature] : []} />
              </Fragment>
            );
          })}
        </MapContainer>
      </Box>
      <RiskLegend layer="rainfall" title="Flood Risk" />
    </Paper>
  );
}
