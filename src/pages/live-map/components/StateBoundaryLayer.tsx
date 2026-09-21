import { useMemo } from 'react';
import { GeoJSON } from 'react-leaflet';
import type { PathOptions } from 'leaflet';
import type { DistrictFeature, DistrictFeatureCollection } from '../districtGeo';

interface StateBoundaryLayerProps {
  stateName: string;
  /** The matching feature(s) from the india-states.json dataset (look them
   *  up with `extractStateName` against `useIndiaStates()`'s features) - one
   *  for an ordinary state, TWO when `stateName` is a combined circle like
   *  "Bihar & Jharkhand" (see LiveMapPage's `selectedStateFeatures`), so
   *  both real states' edges get outlined together. Empty while the
   *  dataset hasn't loaded / has no match yet. */
  features: DistrictFeature[];
}

// A bright cyan that doesn't collide with any color already in play here:
// the red/orange/yellow/green risk fills, the gray "no data" fill, or the
// dark/blue district-border colors - so a state's own edge always reads as
// a distinct line, not just a thicker district border.
const STATE_OUTLINE_STYLE: PathOptions = {
  color: '#22d3ee',
  weight: 2.75,
  opacity: 0.95,
  fill: false,
};

/**
 * Highlights just a state's own outer edge, drawn directly from the real
 * Survey-of-India state polygon (see districtGeo.ts's header for
 * provenance) rather than derived from the district layer underneath it.
 *
 * An earlier version of this component dissolved the state's own district
 * polygons into an outline client-side (see the now-unused
 * `stateOutline.ts`), because the previous boundary source had no
 * government-approved state-level file to draw directly - only districts.
 * The current source ships real state polygons, so that workaround is no
 * longer needed.
 */
export function StateBoundaryLayer({ stateName, features }: StateBoundaryLayerProps) {
  const collection: DistrictFeatureCollection = useMemo(
    () => ({ type: 'FeatureCollection', features }),
    [features]
  );

  if (features.length === 0) return null;

  return <GeoJSON key={`${stateName}-outline-${features.length}`} data={collection} style={STATE_OUTLINE_STYLE} interactive={false} />;
}
