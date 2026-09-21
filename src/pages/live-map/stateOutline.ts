// UNUSED as of the Survey-of-India boundary source switch - nothing in this
// app imports dissolveStateOutline() anymore. StateBoundaryLayer.tsx now
// draws a state's edge directly from the real india-states.json polygon
// instead of dissolving it out of district polygons, which is what this
// file existed to do (see its own doc comment below for why that used to
// be necessary). Safe to delete this file; kept only because this session
// has no way to delete files on your device - please remove it by hand:
// src/pages/live-map/stateOutline.ts
import type { DistrictFeature } from './districtGeo';

type Point = [number, number];

function ringEdges(ring: Point[]): [Point, Point][] {
  const edges: [Point, Point][] = [];
  for (let i = 0; i < ring.length - 1; i++) {
    edges.push([ring[i], ring[i + 1]]);
  }
  return edges;
}

// Rounded to ~0.11m of precision - enough to treat two coordinates copied
// from the same source vertex as identical, without being so coarse that
// genuinely different nearby points collapse together.
function keyOf(pt: Point): string {
  return `${pt[0].toFixed(6)},${pt[1].toFixed(6)}`;
}

/**
 * Dissolves a state's district polygons down to just its outer perimeter,
 * by canceling out every edge that's shared by two adjacent districts -
 * each side of a shared border walks that exact segment in the opposite
 * direction, since every ring in this data winds the same way - and
 * keeping only the edges that appear exactly once: the true state
 * boundary (plus any genuine holes/enclaves, which are equally walked
 * only once).
 *
 * This is a lightweight, dependency-free stand-in for a real polygon-union
 * library (turf, JSTS, ...) - none are installed in this project, and this
 * app has no way to install one and rebuild on the user's machine from
 * here. It works because every district these features come from is cut
 * from one topologically consistent source file - udit-001/india-maps-data
 * (MIT-licensed, the same boundary source district coloring already uses;
 * see districtGeo.ts's header) - so two neighboring districts' shared edge
 * really is the exact same vertices, not an independently-simplified
 * approximation. No separate, similarly-licensed state-only boundary file
 * was available to fetch instead (the obvious alternatives are either
 * district-level under a different name, like this app's own source, or
 * derived from GADM, whose license disallows redistribution/commercial use
 * without permission) - so this derives the state outline from data
 * already being fetched anyway, rather than trusting an unlicensed or
 * restrictively-licensed third source.
 *
 * Occasional stray short segments are possible if this source's per-file
 * districts ever disagree by a vertex or two along a shared border (a data
 * quality issue in the upstream file, not in this logic) - a real
 * union library would tolerate that; this technique doesn't.
 */
export function dissolveStateOutline(features: DistrictFeature[]): GeoJSON.Feature<GeoJSON.MultiLineString> {
  const seen = new Map<string, { count: number; edge: [Point, Point] }>();

  const visitRing = (ring: number[][]) => {
    const pts = ring as Point[];
    for (const [a, b] of ringEdges(pts)) {
      const ka = keyOf(a);
      const kb = keyOf(b);
      const undirectedKey = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const existing = seen.get(undirectedKey);
      if (existing) {
        existing.count += 1;
      } else {
        seen.set(undirectedKey, { count: 1, edge: [a, b] });
      }
    }
  };

  features.forEach((feature) => {
    const geom = feature.geometry;
    if (!geom) return;
    if (geom.type === 'Polygon') {
      (geom.coordinates as number[][][]).forEach((ring) => visitRing(ring));
    } else if (geom.type === 'MultiPolygon') {
      (geom.coordinates as number[][][][]).forEach((poly) => poly.forEach((ring) => visitRing(ring)));
    }
  });

  const boundaryLines: Point[][] = [];
  seen.forEach(({ count, edge }) => {
    if (count === 1) boundaryLines.push(edge);
  });

  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'MultiLineString', coordinates: boundaryLines },
  };
}
