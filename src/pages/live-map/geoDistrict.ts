import type { Site } from '@/features/sites/types';
import { extractNames, canonicalDistrictName, type DistrictFeature } from './districtGeo';

/**
 * Resolves which REAL district polygon a tower's own GPS coordinates fall
 * inside, instead of trusting whatever the tower's stored `district` text
 * field happens to say - added per explicit request: "Group towers by their
 * actual geographic location (latitude/longitude)... District boundaries
 * should be used as the geographic reference, while the tower's coordinates
 * determine which district it actually belongs to. Do not let a tower's
 * existing district field override its actual map location."
 *
 * The stored `district` column is ops/telecom data entered when a tower was
 * registered, and can drift out of sync with reality (a tower physically
 * sitting just across a district line from where its record says it is).
 * The government-sourced boundary polygons this app already draws (see
 * districtGeo.ts) are the actual geographic authority, so this is a plain
 * point-in-polygon test of (longitude, latitude) against those same
 * polygons - not a new data source, just using the one already on screen to
 * decide district membership instead of a free-text field.
 *
 * Hand-written (no turf/geojson library is installed in this project) using
 * the standard ray-casting algorithm, with a per-district bounding-box
 * pre-check so resolving a large state's real tower count (19,000+ in one
 * circle) stays fast - almost every tower only needs the full point-in-ring
 * test run against the one or two districts whose bbox could plausibly
 * contain it, not all ~10-75 districts in the state.
 */

type Position = [number, number]; // [lng, lat], GeoJSON coordinate order
type Ring = Position[];

function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** `rings[0]` is a polygon's outer boundary; any further ring is a hole cut
 *  out of it - a point landing inside one of those holes is actually
 *  OUTSIDE the polygon (donut shape), not inside it. */
function pointInPolygonRings(lng: number, lat: number, rings: Ring[]): boolean {
  if (rings.length === 0 || !pointInRing(lng, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lng, lat, rings[i])) return false;
  }
  return true;
}

/** Normalizes a feature's geometry into a flat list of polygons (each its
 *  own list of rings), so a plain `Polygon` and a multi-part `MultiPolygon`
 *  (a district split into an exclave plus a mainland piece, say) are
 *  checked identically. */
function polygonsOf(feature: DistrictFeature): Ring[][] {
  const geometry = feature.geometry;
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates as Ring[]];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates as Ring[][];
  return [];
}

interface BBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

function bboxOfPolygons(polygons: Ring[][]): BBox {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  polygons.forEach((rings) =>
    rings.forEach((ring) =>
      ring.forEach(([lng, lat]) => {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      })
    )
  );
  return { minLng, minLat, maxLng, maxLat };
}

/** Plain average of every outer-ring vertex across a feature's polygon(s) -
 *  not a true area-weighted centroid, just a cheap, stable "roughly the
 *  middle of this shape" point good enough for the nearest-district tiebreak
 *  in `findDistrictForPoint` below. */
function centroidOfPolygons(polygons: Ring[][]): Position {
  let sumLng = 0;
  let sumLat = 0;
  let count = 0;
  polygons.forEach((rings) => {
    const outer = rings[0];
    if (!outer) return;
    outer.forEach(([lng, lat]) => {
      sumLng += lng;
      sumLat += lat;
      count++;
    });
  });
  return count > 0 ? [sumLng / count, sumLat / count] : [0, 0];
}

interface BoundaryEntry {
  polygons: Ring[][];
  canonicalName: string;
  bbox: BBox;
  centroid: Position;
}

/** Builds a lookup structure once per district-boundary feature set (a few
 *  dozen to ~75 features per state) - the expensive per-tower work below
 *  only ever repeats the cheap bbox check against this precomputed list,
 *  never re-parses a feature's geometry. */
function buildBoundaryIndex(features: DistrictFeature[]): BoundaryEntry[] {
  const entries: BoundaryEntry[] = [];
  features.forEach((feature) => {
    // Skip the "Pakistan-occupied Jammu and Kashmir (PoJK)" placeholder
    // (flagged `claimedNotAdministered` by docs/generate_boundaries.py - see
    // DistrictLayer.tsx's own doc comment for the full background) - added
    // 2026-09-28 per a real tower's hover tooltip naming this district,
    // which should never happen. That polygon is shown on the map
    // deliberately, for compliance with India's own official government map
    // (it depicts a real area India claims but doesn't administer), but no
    // actual Indus tower can legitimately BE there - a real tower's own
    // coordinates testing "inside" it is bad/imprecise GPS data (most likely
    // a tower genuinely near the Line of Control, or a data-entry error),
    // never a real deployment in unadministered territory. Excluding it here
    // only affects which polygon a TOWER resolves to (this file); the real
    // boundary polygon itself still renders exactly as before (dashed gray,
    // claimed/not-administered tooltip) whenever `DistrictLayer` draws the
    // actual government boundary - this file has no say over that. A tower
    // whose coordinates only land here now falls through to the site's own
    // recorded `district` field, same as any tower that doesn't land inside
    // ANY polygon (see `resolveGeoDistricts`'s own doc comment) - not a
    // fabricated value, just the one real value that already exists for it.
    if (feature.properties?.claimedNotAdministered === true) return;
    const names = extractNames(feature);
    if (!names) return;
    const polygons = polygonsOf(feature);
    if (polygons.length === 0) return;
    entries.push({
      polygons,
      canonicalName: canonicalDistrictName(names.district, names.state),
      bbox: bboxOfPolygons(polygons),
      centroid: centroidOfPolygons(polygons),
    });
  });
  return entries;
}

/**
 * Found 2026-09-28: reported by the user as three districts (Ramban, Punch,
 * Sheohar - two different states) showing zero live towers and no coloring
 * in the Indus/Towers view, despite genuinely having monitored towers.
 * Investigated by testing every one of each district's OWN boundary vertices
 * against every OTHER district's polygon in the same file: roughly HALF of
 * Ramban's and Punch's own boundary points, and Sheohar's, also tested
 * "inside" a neighboring district's polygon. This project's per-district
 * Douglas-Peucker simplification (hand-written - see districtGeo.ts's header,
 * this sandbox has no gdal/shapely) runs independently on each state file, so
 * two neighboring districts' shared border isn't always simplified to the
 * identical line on both sides - it can end up overlapping by a sliver
 * instead of meeting exactly (this project's own notes already flagged a
 * milder version of this as "a handful of tiny spurious slivers" - this is
 * the same defect, just affecting a much larger share of these three
 * districts' own borders).
 *
 * `findDistrictForPoint` used to return the FIRST entry (array order, which
 * is basically arbitrary) whose polygon matched - so a border tower that
 * legitimately matched BOTH its real district and a neighbor's
 * over-simplified polygon always lost to whichever neighbor happened to come
 * earlier in the boundary file, even though its real district also matched.
 * Small districts (Sheohar is one of India's smallest) are hit hardest,
 * since a larger fraction of their whole area sits close enough to a border
 * for this to matter.
 *
 * Fix: collect every matching entry instead of stopping at the first, and
 * when more than one matches, pick whichever entry's overall shape (its
 * `centroid`, computed once in `buildBoundaryIndex`) is geographically
 * CLOSEST to the point. A point near its own district's border is still,
 * overwhelmingly, much closer to that district's own middle than to a
 * neighbor's - so this resolves the ambiguity correctly in the real-world
 * case without needing to re-simplify the source boundary data (not
 * possible in this sandbox - no gdal/fiona/shapely available). The common
 * case (a point matching exactly one district, i.e. almost every interior
 * point) is unaffected either way.
 */
function findDistrictForPoint(lng: number, lat: number, index: BoundaryEntry[]): string | null {
  let best: BoundaryEntry | null = null;
  let bestDistSq = Infinity;
  for (const entry of index) {
    const { minLng, minLat, maxLng, maxLat } = entry.bbox;
    if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;
    if (!entry.polygons.some((rings) => pointInPolygonRings(lng, lat, rings))) continue;
    const dLng = lng - entry.centroid[0];
    const dLat = lat - entry.centroid[1];
    const distSq = dLng * dLng + dLat * dLat;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      best = entry;
    }
  }
  return best?.canonicalName ?? null;
}

/**
 * Resolves every site's REAL district by testing its (longitude, latitude)
 * against the actual government boundary polygons, keyed by site id.
 * Falls back to the site's own recorded `district` field only for the rare
 * tower whose coordinates don't land inside any polygon at all (e.g. a
 * simplified boundary's edge, or a genuinely offshore/erroneous
 * coordinate) - per this project's own never-fabricate rule, that fallback
 * isn't inventing a new value, it's the one real district value that does
 * exist for that tower when geography itself can't resolve one. Geography
 * wins over the stored field in every other case.
 */
export function resolveGeoDistricts(sites: Site[], features: DistrictFeature[]): Map<string, string> {
  const index = buildBoundaryIndex(features);
  const result = new Map<string, string>();
  if (index.length === 0) return result;
  sites.forEach((site) => {
    const resolved = findDistrictForPoint(site.longitude, site.latitude, index);
    result.set(site.id, resolved ?? site.district);
  });
  return result;
}
