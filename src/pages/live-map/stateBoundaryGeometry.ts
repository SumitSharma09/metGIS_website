import type { DistrictFeature } from './districtGeo';

type Ring = [number, number][]; // [lon, lat] points, matching GeoJSON convention

export interface BoundaryCheck {
  isInside(lat: number, lon: number): boolean;
  /** Uniformly-random point inside the boundary, via rejection sampling
   *  within its bounding box - same technique as indiaBoundary.ts's
   *  randomPointInIndia(), just generalized to an arbitrary set of real
   *  state polygons instead of the one hardcoded national outline. */
  randomPoint(): { lat: number; lon: number };
}

function pointInRing(lat: number, lon: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

// A GeoJSON polygon's rings: index 0 is the outer boundary, any further
// rings are holes cut out of it - a point only counts as "inside" the
// polygon when it's inside the outer ring and inside none of the holes.
function pointInPolygonRings(lat: number, lon: number, rings: Ring[]): boolean {
  if (rings.length === 0 || !pointInRing(lat, lon, rings[0])) return false;
  for (let h = 1; h < rings.length; h += 1) {
    if (pointInRing(lat, lon, rings[h])) return false;
  }
  return true;
}

/**
 * Builds a point-in-polygon test (with hole support) plus a rejection-
 * sampling random-point generator from one or more real state boundary
 * features (india-states.json - see districtGeo.ts's header for provenance).
 * Multiple features are supported so a combined circle's two constituent
 * states (see splitCircleStateName in districtRisk.ts) both count as
 * "inside" together, exactly like `selectedStateFeatures` already does for
 * StateBoundaryLayer's outline.
 *
 * Used by WindFlowLayer to confine the animated wind-flow field to just the
 * currently selected state(s) rather than the whole country, once a state
 * is picked - otherwise the field's inverse-distance-weighted interpolation
 * (windField.ts) has no reason to stop at a state's edge and keeps
 * extrapolating that one state's sparse wind samples across the entire
 * visible map.
 *
 * Returns null for an empty feature list (nothing picked yet, or the
 * boundary dataset hasn't loaded) so callers fall back to the whole-India
 * boundary (indiaBoundary.ts).
 */
export function buildStateBoundary(features: DistrictFeature[]): BoundaryCheck | null {
  if (features.length === 0) return null;

  const polygons: Ring[][] = []; // each entry: one polygon's rings (outer + holes)

  features.forEach((feature) => {
    const geom = feature.geometry;
    if (!geom) return;
    if (geom.type === 'Polygon') {
      polygons.push(geom.coordinates as unknown as Ring[]);
    } else if (geom.type === 'MultiPolygon') {
      (geom.coordinates as unknown as Ring[][]).forEach((rings) => polygons.push(rings));
    }
  });

  if (polygons.length === 0) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  polygons.forEach((rings) => {
    rings.forEach((ring) => {
      ring.forEach(([lon, lat]) => {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
      });
    });
  });

  if (!Number.isFinite(minLat) || !Number.isFinite(minLon)) return null;

  function isInside(lat: number, lon: number): boolean {
    if (lat < minLat || lat > maxLat || lon < minLon || lon > maxLon) return false;
    return polygons.some((rings) => pointInPolygonRings(lat, lon, rings));
  }

  function randomPoint(): { lat: number; lon: number } {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const lat = minLat + Math.random() * (maxLat - minLat);
      const lon = minLon + Math.random() * (maxLon - minLon);
      if (isInside(lat, lon)) return { lat, lon };
    }
    // Astronomically unlikely (a real state's polygon fills a reasonable
    // fraction of its own bounding box) - falls back to the box's center
    // so callers never need to handle a null/undefined result.
    return { lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 };
  }

  return { isInside, randomPoint };
}
