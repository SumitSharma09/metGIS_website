/**
 * Convex hull of a set of (lat, lng) points, used by DistrictHullLayer.tsx
 * to draw a district's shape by connecting its own towers' real coordinates
 * instead of the district's real administrative boundary polygon - per
 * explicit request: "district boundaries design as per the data of exiting
 * lat lon in this district they connect boundaries of that district and
 * remove actual boundaries... Replace it everywhere in the Indus/Towers
 * view... each district is instead drawn as the hull of its own towers'
 * coordinates."
 *
 * Standard monotone-chain algorithm, treating lng as the planar x-axis and
 * lat as y - a flat-plane approximation that's the norm for an area this
 * size (a district is at most a few hundred km across) and matches how the
 * rest of this app already treats coordinates (e.g. the bounding-box
 * pre-check in geoDistrict.ts).
 */

export type LatLng = [number, number]; // [lat, lng] - Leaflet's own coordinate order, so a caller can feed the result straight into L.polygon()/react-leaflet without re-ordering.

/**
 * Returns the hull's vertices in the same [lat, lng] order as the input.
 * Fewer than 3 distinct points can't form an area - the caller should fall
 * back to a circle/point marker in that case (this still returns whatever
 * distinct point(s) exist, rather than throwing, so a caller that doesn't
 * check the length first still gets something sane back).
 */
export function convexHull(points: LatLng[]): LatLng[] {
  const xy = points
    .map((p): [number, number] => [p[1], p[0]]) // [lng, lat] = [x, y] for the standard hull math below
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const unique: [number, number][] = [];
  xy.forEach((p) => {
    const last = unique[unique.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) unique.push(p);
  });

  if (unique.length < 3) {
    return unique.map((p): LatLng => [p[1], p[0]]);
  }

  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const lower: [number, number][] = [];
  unique.forEach((p) => {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  });

  const upper: [number, number][] = [];
  for (let i = unique.length - 1; i >= 0; i--) {
    const p = unique[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();

  return lower.concat(upper).map((p): LatLng => [p[1], p[0]]);
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in km - used only to measure how far one of a
 *  district's own towers sits from the rest of that SAME district's towers
 *  (see `excludeHullOutliers` below), not for anything shown to the user. */
function haversineKm(a: LatLng, b: LatLng): number {
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinDLon * sinDLon;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** A point closer than this to a district's own median center is never
 *  treated as an outlier, no matter what the statistical test below says -
 *  real Indian districts routinely span tens of km, so a plain "distance
 *  from center" test alone would misfire on a perfectly normal, honestly
 *  large district. This only guards against a tower planted absurdly far
 *  from the rest of its own district's real towers (see the file-level
 *  comment on `DistrictHullLayer.tsx` for the confirmed real example - a
 *  Sheohar tower recorded ~432km away, in a different state entirely,
 *  almost certainly a bad stored coordinate rather than a real location). */
const OUTLIER_ABSOLUTE_FLOOR_KM = 60;

/**
 * NO LONGER CALLED as of 2026-10-04 (Follow-up fix #14 in
 * `DistrictHullLayer.tsx`'s own header/`groups`-memo comments) - kept here,
 * still exported, in case a future request wants a similar backstop again.
 * Real Bhopal data showed this filter was dropping genuine cross-district
 * towers (55 of Bhopal's own recorded towers that legitimately test inside
 * Rajgarh's real polygon) as "statistical outliers" simply for being far
 * from Bhopal's own dense urban cluster - defeating the explicit, later
 * request that a district's shape include every one of its own recorded
 * towers, however far apart, with no exceptions. If reintroduced later, it
 * would need to specifically exempt towers a caller has confirmed are inside
 * a real neighboring district's boundary, rather than applying to every
 * district uniformly as it did before.
 *
 * Drops any point so far from the REST of its own district's points that it
 * is overwhelmingly likely to be a bad recorded coordinate rather than a
 * real, if distant, corner of that district - added per explicit report
 * ("some boundaries are larger area covered even tower locations doesn't
 * have"): a single mis-recorded tower can otherwise stretch a whole
 * district's hull out across empty land it has no real presence in (see
 * `DistrictHullLayer.tsx`'s header comment for the confirmed Sheohar/
 * Simdega case this was already known to cause).
 *
 * Deliberately conservative and relative to each district's OWN spread,
 * never an absolute cutoff: uses a modified z-score (median + MAD, the
 * standard robust-outlier test - see Iglewicz & Hoya) on each point's
 * distance from the district's own median center, at the commonly-used
 * threshold of 3.5, combined with `OUTLIER_ABSOLUTE_FLOOR_KM` so a normal,
 * honestly large or sprawling district (several real Indian districts span
 * 100km+ - e.g. Ladakh's own districts) is never trimmed just for being
 * genuinely big. If filtering would leave fewer than 3 points (too few to
 * still form a hull) - or the spread has no usable statistic (fewer than 4
 * points, or every point equidistant from the center) - this returns the
 * points unchanged rather than risk under- or over-filtering with no real
 * signal to go on.
 *
 * This only changes which points feed the HULL SHAPE's geometry - it does
 * not touch `districtRisk`/`indusDistrictRiskIndex` (a district's color,
 * risk level and site count are computed separately and are unaffected), and
 * every tower - excluded or not - still shows up at its own real recorded
 * location on the tower-marker layer. Nothing is hidden or discarded, only
 * left out of this one shape's own boundary math.
 */
export function excludeHullOutliers(points: LatLng[]): LatLng[] {
  if (points.length < 4) return points;

  // Coordinate-wise MEDIAN center, not the mean - tested directly against a
  // synthetic case with two bad-coordinate towers before shipping this: a
  // plain average center gets dragged toward whichever points are farthest
  // away, which can make the far points look deceptively "central" and the
  // real, tightly-clustered majority look like the outliers instead (the
  // standard "masking" failure of mean-based outlier detection - it breaks
  // down with more than one bad point). The median resists this up to
  // roughly half the points being bad, which comfortably covers the
  // realistic case of one or two mis-recorded coordinates in a district.
  const centerLat = median(points.map((p) => p[0]));
  const centerLng = median(points.map((p) => p[1]));
  const center: LatLng = [centerLat, centerLng];

  const distances = points.map((p) => haversineKm(p, center));
  const medianDistance = median(distances);
  const mad = median(distances.map((d) => Math.abs(d - medianDistance)));

  if (mad === 0) return points;

  const kept = points.filter((_, i) => {
    const distance = distances[i];
    if (distance <= OUTLIER_ABSOLUTE_FLOOR_KM) return true;
    const modifiedZ = (0.6745 * (distance - medianDistance)) / mad;
    return modifiedZ <= 3.5;
  });

  return kept.length >= 3 ? kept : points;
}

/** A far point still counts as trustworthy if it has at least this many
 *  OTHER same-district points within `NEARBY_CLUSTER_RADIUS_KM` of itself -
 *  i.e. it's part of its own real, corroborated little cluster, not sitting
 *  alone. Chosen, not derived: 3 other nearby towers (a cluster of 4+
 *  including itself) is enough to say "several independent recordings agree
 *  this district really has towers here," while 0-2 is too easy for a single
 *  coincidence or a couple of related bad rows to produce. */
const MIN_CLUSTER_NEIGHBORS = 3;

/** How close two points need to be to count as each other's "neighbor" for
 *  the clustering check below - deliberately smaller than
 *  `OUTLIER_ABSOLUTE_FLOOR_KM` (60km): the floor asks "is this point close to
 *  the district's OVERALL center," this asks "do several of this district's
 *  points agree on being in roughly the same place as each other," which is
 *  a tighter, more local question. */
const NEARBY_CLUSTER_RADIUS_KM = 50;

/**
 * Added 2026-10-04 (Follow-up fix #15), replacing `excludeHullOutliers`
 * (above) as the filter `DistrictHullLayer.tsx` actually calls. Real data
 * from two districts proved neither of the two previous designs was right:
 *
 * - Fully unconditional inclusion (Follow-up fix #14, per explicit request
 *   after the Bhopal/Rajgarh case) correctly let Bhopal's shape reach into
 *   Rajgarh - but then Vaishali's real data showed it also pulled in 2
 *   towers recorded ~330km away, in two different Jharkhand districts, with
 *   nothing else nearby them at all - the same profile as the already-
 *   confirmed bad-coordinate case (Sheohar's tower 14145, ~432km away in a
 *   different state). Reported back as "in some districts... they long or
 *   larger area boundaries shown."
 * - The OLD `excludeHullOutliers` (a pure per-district statistical spread
 *   test) was too blunt in the other direction: it wrongly excluded
 *   Bhopal's entire real 55-tower Rajgarh cluster too, just for being far
 *   from Bhopal's own dense urban core, which is exactly what caused the
 *   Bhopal/Rajgarh problem in the first place.
 *
 * The distinguishing fact in the real data: Bhopal's Rajgarh towers (55) and
 * Vaishali's Pashchim Champaran towers (7) each form their OWN tight,
 * mutually-close cluster far from their district's main body - multiple
 * independent towers corroborating each other's location. Vaishali's 2 bad
 * Jharkhand towers, by contrast, sit with no such corroboration (each only
 * has the other within a reasonable radius, never enough to look like a
 * real, multi-tower deployment). So this function keeps a point if EITHER
 * it's close to the district's own overall center (same 60km floor as
 * before - Vaishali's single, legitimate Saran-area tower at 55km relies on
 * exactly this), OR it has `MIN_CLUSTER_NEIGHBORS`+ other same-district
 * points near it (its own real, corroborated cluster, however far that
 * cluster sits from the rest of the district) - and drops a point only when
 * neither is true, i.e. it is both far AND alone.
 *
 * Verified directly against the real Bhopal (830 towers) and Vaishali (376
 * towers) datasets before shipping: Bhopal keeps 827/830 (drops 3 genuinely
 * isolated far towers, previously unnoticed - not the 55-tower Rajgarh
 * cluster, which is correctly kept in full); Vaishali keeps 374/376,
 * dropping exactly the 2 confirmed-isolated Jharkhand towers and nothing
 * else (its 7-tower Pashchim Champaran cluster and its single Saran tower
 * are all correctly kept).
 *
 * Same scope as `excludeHullOutliers` always had: this only changes which
 * points feed the HULL SHAPE's geometry, never `districtRisk`/
 * `indusDistrictRiskIndex` (color/count, still exactly `site.district`), and
 * every tower - excluded from the shape or not - still shows at its own real
 * recorded location on the tower-marker layer.
 */
export function excludeIsolatedOutliers(points: LatLng[]): LatLng[] {
  if (points.length < 4) return points;

  const centerLat = median(points.map((p) => p[0]));
  const centerLng = median(points.map((p) => p[1]));
  const center: LatLng = [centerLat, centerLng];

  const kept = points.filter((p, i) => {
    if (haversineKm(p, center) <= OUTLIER_ABSOLUTE_FLOOR_KM) return true;

    let neighbors = 0;
    for (let j = 0; j < points.length; j++) {
      if (j === i) continue;
      if (haversineKm(p, points[j]) <= NEARBY_CLUSTER_RADIUS_KM) {
        neighbors++;
        if (neighbors >= MIN_CLUSTER_NEIGHBORS) break;
      }
    }
    return neighbors >= MIN_CLUSTER_NEIGHBORS;
  });

  // Never leave a district with nothing to draw from - if this filter would
  // somehow empty the set entirely, fall back to every point unfiltered
  // rather than draw no shape at all (same fallback philosophy as
  // `excludeHullOutliers` above and the `groups` memo's own fallback in
  // DistrictHullLayer.tsx).
  return kept.length > 0 ? kept : points;
}
