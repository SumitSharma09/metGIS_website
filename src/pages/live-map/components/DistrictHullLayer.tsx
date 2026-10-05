import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import type { Site } from '@/features/sites/types';
import { RISK_COLOR, NO_DATA_COLOR, MAP_RISK_LABEL, type RiskLevel } from '@/utils/severity';
import { normalizeName, type DistrictRiskInfo } from '@/utils/districtRisk';
import { formatDateTime } from '@/utils/formatters';
import type { MapLayer } from '../mapLayers';
import { buildWeatherTooltipHtml, WEATHER_TOOLTIP_CLASSNAME } from '../mapTooltip';
import '../mapTooltip.css';
import { convexHull, excludeIsolatedOutliers, type LatLng } from '../convexHull';

/**
 * Replaces `DistrictLayer` in the Indus/Towers view, per explicit request:
 * "In indus section - district boundaries design as per the data of exiting
 * lat lon in this district they connect boundaries of that district and
 * remove actual boundaries", confirmed with the real government boundary
 * line removed from this view entirely ("Replace it everywhere in the
 * Indus/Towers view - the real boundary line is gone from that view
 * entirely, and each district is instead drawn as the hull of its own
 * towers' coordinates... accepting that it won't match the true district
 * shape").
 *
 * Unlike `DistrictLayer` (which draws one polygon per real GeoJSON feature,
 * whether or not it has any towers), this component has no boundary dataset
 * to iterate at all - it only knows where towers ARE. So a district with no
 * towers in the current scope draws nothing here, and a district's shape is
 * only ever as good as its own towers' spread (a handful of nearby towers
 * draws a small, tight shape even if the real district is much larger) -
 * both accepted tradeoffs of "connect the dots", not bugs.
 *
 * Towers are grouped by their own stored `site.district` field (the raw
 * indus_locations `District` column) - REVERSED 2026-09-30 from an earlier
 * geography-based grouping (each tower's real district resolved from its own
 * lat/lng against the government boundary polygons in geoDistrict.ts) after
 * that approach left a district like Sheohar permanently gray: Sheohar's own
 * three towers with a live reading each geo-resolved to a DIFFERENT other
 * district (one of them 432km away, in a different state - almost certainly
 * a bad recorded coordinate, not a real border effect), so none of their
 * data ever counted toward "Sheohar" under geography, even though their own
 * DB rows plainly say Sheohar. Explicitly asked the user to choose between
 * keeping pure geography (accepting this outcome for similarly small/
 * distorted districts) or trusting the recorded `District` column instead;
 * the user chose the latter. This is the exact same grouping
 * `districtRiskIndex` (LiveMapPage) now uses to color/count each district -
 * so a shape drawn here and its fill color always agree on which towers
 * belong to it. One accepted consequence: a tower with a badly wrong
 * recorded coordinate (like the Sheohar/Simdega one above) can now stretch
 * its district's hull out to wherever that tower's coordinates actually
 * are, since the hull still connects towers' REAL coordinates - grouping
 * changed, not the geometry itself. UPDATE 2026-09-30: that exact
 * consequence was reported back as a bug ("some boundaries are larger area
 * covered even tower locations doesn't have") - `excludeHullOutliers`
 * (convexHull.ts) is now applied to each district's points before the hull
 * is drawn, so a single badly-recorded tower can no longer balloon its
 * district's shape out across land none of its real towers are actually
 * near. See that function's own comment for why the threshold is relative
 * to each district's own spread rather than a fixed distance - a fixed
 * cutoff would risk misfiring on a real, honestly large district.
 * UPDATE 2026-10-01: a geography-based exclusion layer was added (and then
 * patched 2026-10-02 for a regression it caused in Sheohar/Ramban) to keep a
 * tower out of its DB-labeled district's HULL SHAPE whenever its own
 * coordinates geographically placed it inside a different, real district
 * (the confirmed Kargil case - 5 towers testing inside neighboring Leh).
 * **REVERTED 2026-10-03 per explicit instruction**: "Please make a logic
 * like this actual boundaries of district cove in case, if some tower in
 * another district they make large boundaries to take this area in this
 * district., same as all districts. use this logic for all in indus
 * sections." A tower recorded under a district is never excluded from that
 * district's shape for being geographically inside a neighbor's real
 * administrative area - the shape simply grows to cover it, exactly what a
 * convex hull does naturally when handed every one of a district's own
 * recorded points. This deliberately restores, as intended behavior, the
 * exact geometry that originally prompted the Kargil complaint - see the
 * `groups` memo's own doc comment below for the full detail.
 * UPDATE 2026-10-04, Follow-up fix #14: `excludeHullOutliers` (the
 * statistical distance filter from the 2026-09-30 update above) was made NO
 * LONGER CALLED here, per explicit follow-up confirmation using real Bhopal
 * data, so a district's hull would unconditionally include every one of its
 * own recorded towers with zero exceptions. Known tradeoff at the time: the
 * original bad-Sheohar-coordinate case this filter was built for (a tower
 * recorded ~432km away, in a different state, almost certainly a data-entry
 * error) could once again stretch a district's shape out across unrelated
 * land.
 * UPDATE 2026-10-04, Follow-up fix #15 (same day): that tradeoff turned out
 * to matter in practice within minutes - real Vaishali data ("in some
 * districts without towers they long or larger area boundaries shown")
 * showed 2 towers recorded ~330km away, in two different Jharkhand
 * districts, with nothing else nearby them at all - the same bad-coordinate
 * profile as Sheohar's tower 14145. `excludeIsolatedOutliers` (convexHull.ts)
 * now replaces the unconditional inclusion from fix #14: a far tower is kept
 * if it's part of its own corroborated cluster of several nearby same-
 * district towers (a real cross-district deployment, like Bhopal's 55-tower
 * Rajgarh cluster or Vaishali's own 7-tower Pashchim Champaran cluster), and
 * is dropped only when it is both far from the district's main body AND has
 * no such corroboration - see that function's own doc comment for the full
 * real-data verification and the reasoning for this specific design. See the
 * `groups`-adjacent render-effect comment below (where `hullPoints` is
 * built) for where this is applied.
 *
 * Implemented imperatively (`L.layerGroup()` via `useMap()`), the same
 * pattern `ClusteredSiteMarkers.tsx` uses, rather than react-leaflet's
 * declarative `<Polygon>`/`<Circle>` - this keeps the tooltip/popup/click
 * wiring identical in shape to `DistrictLayer.tsx`'s own `onEachFeature`
 * (same `buildWeatherTooltipHtml` call, same risk-row logic), and one
 * `layerGroup` can hold a per-district mix of polygons and circles (the
 * fallback for a district with fewer than 3 distinct tower locations, which
 * can't form a hull with any area) without react-leaflet needing to know
 * about that branching.
 */

function sameDistrict(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return normalizeName(a) === normalizeName(b);
}

// A district resolved from just 1 or 2 distinct tower locations (or towers
// that all sit at the exact same point) can't form a hull with any area -
// convexHull() itself returns fewer than 3 points in that case rather than
// throwing. Drawn as a plain circle centered on those towers' average
// location instead, so the district still shows up on the map somewhere
// close to where its towers actually are, rather than vanishing outright.
const HULL_FALLBACK_CIRCLE_RADIUS_METERS = 15000;

interface DistrictGroup {
  /** The first `site.district` value seen for this group (the raw stored
   *  field - see this file's header comment for why this is no longer
   *  geography-resolved), matching how `buildDistrictRiskIndex` now picks
   *  `canonicalName` too - so this always names the same district
   *  `districtRisk` colored it under. */
  canonicalName: string;
  points: LatLng[];
}

interface DistrictHullLayerProps {
  stateName: string;
  /** Every tower in the current state scope (LiveMapPage's `riskScopeSites`)
   *  - NOT narrowed to only towers with a live observation, since a shape
   *  should reflect every real tower's location whether or not it happens
   *  to have a reading at the currently selected hour. */
  sites: Site[];
  /** Keyed by normalizeName(district name) - the same map `DistrictLayer`
   *  consumes, built by `buildDistrictRiskIndex` with the matching
   *  `districtFor` resolver so a shape drawn here and its fill color/count
   *  always agree on which towers belong to it. */
  districtRisk: Map<string, DistrictRiskInfo>;
  colors?: Record<RiskLevel, string>;
  layer?: MapLayer;
  selectedDistrict: string | null;
  selectedTehsil?: string | null;
  onSelectDistrict: (districtName: string, stateName: string) => void;
  enableFitBounds: boolean;
  getFillColor?: (info: DistrictRiskInfo) => string;
  asOf?: string;
}

export function DistrictHullLayer({
  stateName,
  sites,
  districtRisk,
  colors = RISK_COLOR,
  layer: mapLayer,
  selectedDistrict,
  selectedTehsil,
  onSelectDistrict,
  enableFitBounds,
  getFillColor,
  asOf,
}: DistrictHullLayerProps) {
  const map = useMap();
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Create the layer group once per map instance - same lifecycle as
  // ClusteredSiteMarkers' own markerClusterGroup.
  useEffect(() => {
    const group = L.layerGroup();
    layerGroupRef.current = group;
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
      layerGroupRef.current = null;
    };
  }, [map]);

  // Groups every in-scope tower by its own recorded district name. Kept as
  // its own memo (rather than inline in the rebuild effect below) so the
  // fit-bounds effect can reuse the exact same grouping without
  // recomputing it.
  //
  // History: a geography-verified exclusion (added 2026-10-01 for the
  // reported Kargil case, then patched 2026-10-02 for the Sheohar/Ramban
  // regression it caused) used to drop a tower from its DB-labeled
  // district's shape whenever its own coordinates geographically placed it
  // inside a DIFFERENT, real district. **Reverted 2026-10-03 per explicit
  // instruction**: "Please make a logic like this actual boundaries of
  // district cove in case, if some tower in another district they make
  // large boundaries to take this area in this district., same as all
  // districts. use this logic for all in indus sections." - i.e. a tower
  // recorded under a district should never be EXCLUDED from that district's
  // shape just because it geographically sits inside a neighboring real
  // district; instead the shape should simply grow large enough to include
  // it, exactly like a convex hull naturally does when every one of a
  // district's own recorded points is handed to it. This is a deliberate,
  // explicit reversal - it restores the exact behavior that originally
  // prompted the Kargil complaint ("some district towers show out of the
  // district... like kargil"), now treated as intended rather than a bug:
  // any of Kargil's 98 recorded towers, wherever their own coordinates
  // physically fall, stretches Kargil's own shape to cover that area. Applies
  // uniformly to every district, with no special-casing - the grouping below
  // is now purely `site.district`, the same simple rule for all of them.
  //
  // `geoDistrictBySiteId` is intentionally no longer consulted here (removed
  // from this component's props entirely) - `ClusteredSiteMarkers` still uses
  // its own copy of that same map for individual tower marker labels, a
  // separate, narrower concern this reversal does not touch.
  //
  // UPDATE 2026-10-04, Follow-up fix #14: at first `excludeHullOutliers` (a
  // SEPARATE statistical distance filter, applied further down in the render
  // effect) was left running as a backstop against a single wildly bad
  // recorded coordinate (the confirmed Sheohar/tower-14145 case, ~432km away
  // in a different state). But real Bhopal data supplied by the user proved
  // this filter defeats the whole point of this reversal for a large,
  // dense-cored district: of 830 towers recorded under Bhopal, 770 form a
  // tight urban cluster and 60 sit 62-135km away - 55 of THOSE 60 genuinely
  // test inside Rajgarh's real polygon (confirmed by testing them directly
  // against the shipped Madhya Pradesh boundary data). Because they're so
  // much farther than Bhopal's own dense cluster, `excludeHullOutliers`'s
  // statistical test flagged and dropped all of them - so even after this
  // reversal, Bhopal's shape still would NOT have stretched into Rajgarh to
  // cover them, contradicting the whole point of this change. Per the user's
  // explicit follow-up confirmation ("yes please solve this problem...
  // please make your logic to take all towers in this bhopal district...
  // applicable all districts"), `excludeHullOutliers` is no longer called
  // from this component at all (see the render effect below, where
  // `hullPoints` is built) - every one of a district's own recorded points
  // is now used, unconditionally, full stop (at THIS grouping stage - this
  // memo itself is unaffected either way, since it only decides which
  // district a point belongs to, never which points feed the hull geometry).
  //
  // UPDATE 2026-10-04, Follow-up fix #15 (same day): the "unconditionally,
  // full stop" tradeoff above was replaced within the hour - real Vaishali
  // data showed it also let through towers with no real corroboration at
  // all (an isolated pair ~330km away, matching the known-bad Sheohar/
  // tower-14145 profile). `excludeIsolatedOutliers` (convexHull.ts) is now
  // applied in the render effect below instead - this `groups` memo itself
  // is UNCHANGED by that fix, since filtering happens after grouping, not
  // during it. See this file's header comment and `excludeIsolatedOutliers`'s
  // own doc comment for the full detail.
  const groups = useMemo(() => {
    const map = new Map<string, DistrictGroup>();
    sites.forEach((site) => {
      const name = site.district;
      const key = normalizeName(name);
      const point: LatLng = [site.latitude, site.longitude];

      const existing = map.get(key);
      if (existing) {
        existing.points.push(point);
      } else {
        map.set(key, { canonicalName: name, points: [point] });
      }
    });
    return map;
  }, [sites]);

  // Re-key the rebuild effect whenever the risk coloring should change - same
  // reasoning as DistrictLayer's own `riskFingerprint` (react-leaflet isn't
  // involved here, but `districtRisk` is still a new Map reference on every
  // LiveMapPage recompute, so this keeps the effect from re-binding
  // identical shapes/tooltips on every unrelated render).
  const riskFingerprint = useMemo(
    () =>
      Array.from(districtRisk.entries())
        .map(([name, info]) => `${name}:${info.risk}:${info.avgValue?.toFixed(1) ?? ''}`)
        .join('|'),
    [districtRisk]
  );

  useEffect(() => {
    const group = layerGroupRef.current;
    if (!group) return;
    group.clearLayers();

    const asOfLabel = asOf ? `As likely of ${formatDateTime(asOf)}` : undefined;

    groups.forEach(({ canonicalName, points }) => {
      const isSelected = sameDistrict(canonicalName, selectedDistrict);

      // When a district is selected, every OTHER district's shape is left
      // off the map entirely - added per explicit clarification ("please
      // understand, if some chose district then other district boundaries
      // will be hide on map and show choosing district only"). An earlier
      // pass in this same file read an ambiguous, differently-phrased report
      // the other way (as a bug to stop, not a feature to build) and instead
      // made every shape stay visible regardless of selection - this
      // reverses that: with nothing selected, every district still shows as
      // before; once one is picked, only its own shape remains on the map
      // until it's deselected again.
      if (selectedDistrict && !isSelected) return;

      const info: DistrictRiskInfo =
        districtRisk.get(normalizeName(canonicalName)) ?? { risk: 'none', siteCount: 0, canonicalName };
      const isMonitored = (info.siteCount ?? 0) > 0;

      const pathOptions: L.PathOptions = {
        // Same dark, mostly-opaque stroke DistrictLayer settled on (a
        // translucent white line all but disappeared against the light
        // "street" basemap) - the bright blue selected outline still stands
        // out from it.
        color: isSelected ? '#2563eb' : '#0f172a',
        weight: isSelected ? 3 : 1.25,
        opacity: isSelected ? 1 : 0.8,
        fillColor: isMonitored ? (getFillColor ? getFillColor(info) : colors[info.risk]) : NO_DATA_COLOR,
        fillOpacity: isSelected ? 0.85 : isMonitored ? 0.65 : 0.35,
      };

      // As of Follow-up fix #15, `excludeIsolatedOutliers` replaces the fully
      // unconditional inclusion from fix #14 - see this file's header comment
      // and that function's own doc comment in convexHull.ts for the real
      // Bhopal/Vaishali data that justified this. It keeps a far tower if
      // it's part of its own corroborated cluster (a real cross-district
      // deployment, like Bhopal's Rajgarh towers), and only drops one that is
      // both far AND alone (almost certainly a bad coordinate).
      const hullPoints = excludeIsolatedOutliers(points);
      const hull = convexHull(hullPoints);
      const shape: L.Polygon | L.Circle =
        hull.length >= 3
          ? L.polygon(hull, pathOptions)
          : L.circle(
              [
                hullPoints.reduce((sum, p) => sum + p[0], 0) / hullPoints.length,
                hullPoints.reduce((sum, p) => sum + p[1], 0) / hullPoints.length,
              ],
              { ...pathOptions, radius: HULL_FALLBACK_CIRCLE_RADIUS_METERS }
            );

      // Only the selected district's own tooltip/popup got narrowed down to
      // the picked tehsil (see LiveMapPage's districtRiskScopeSites) - same
      // caveat DistrictLayer's own tehsilNote carries.
      const tehsilNote =
        selectedTehsil && isSelected ? `Tehsil: ${selectedTehsil}` : undefined;
      const rows =
        mapLayer && isMonitored ? [{ label: 'Risk level', value: MAP_RISK_LABEL[info.risk] }] : [];
      const accentColor = isMonitored ? (getFillColor ? getFillColor(info) : colors[info.risk]) : NO_DATA_COLOR;

      const tooltipHtml = buildWeatherTooltipHtml({
        title: canonicalName,
        subtitle: stateName,
        asOf: asOfLabel,
        note: tehsilNote,
        accentColor,
        rows,
      });
      shape.bindTooltip(tooltipHtml, { sticky: true, direction: 'top', className: WEATHER_TOOLTIP_CLASSNAME });

      const popupHtml = `
        <div style="min-width:170px">
          <div style="font-weight:700;font-size:13px;margin-bottom:2px;">${canonicalName}</div>
          <div style="font-size:11.5px;color:#666;">${stateName}${tehsilNote ? ` &middot; ${tehsilNote}` : ''}</div>
        </div>
      `;
      shape.bindPopup(popupHtml);

      shape.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        onSelectDistrict(canonicalName, stateName);
      });
      shape.on('mouseover', () => shape.setStyle({ weight: 3 }));
      shape.on('mouseout', () => shape.setStyle({ weight: isSelected ? 3 : 1.25 }));

      if (isSelected) {
        shape.addTo(group);
        shape.openPopup();
      } else {
        shape.addTo(group);
      }
    });
  }, [
    groups,
    riskFingerprint,
    districtRisk,
    colors,
    mapLayer,
    selectedDistrict,
    selectedTehsil,
    onSelectDistrict,
    getFillColor,
    asOf,
    stateName,
  ]);

  // Fits the map's camera either to the SELECTED district's own tower bounds
  // (when one is picked) or to every drawn district's towers together
  // (state-wide, when none is). History of this effect, for context:
  //
  // It originally re-fit the camera to ONLY the selected district's own
  // bounds on every pick. That was reported as a bug twice - first as
  // neighboring districts scrolling out of the viewport ("if someone click
  // on district choose other's district boundaries is hide"), then again as
  // "if i choose the district they only highlight not other district
  // boundaries hide or disable at that time" - both read (at the time) as
  // "selecting a district must not move the camera at all", so the
  // dependency on `selectedDistrict` was removed entirely and this effect
  // only ever fit the whole state's bounds, never zooming to a selection.
  //
  // REVERSED 2026-09-30 per explicit follow-up: "in indus section - i choose
  // the district they do not redirect the district in the screen please
  // enable this" - i.e. the user DOES want picking a district to navigate/
  // zoom the map to it; the earlier "no camera movement on selection" was
  // the wrong takeaway from the earlier, differently-worded reports (those
  // were actually about the OTHER districts' shapes, not the camera - see
  // the render effect above, which handles hiding them and is unaffected by
  // this change). `selectedDistrict` is back in this effect's dependency
  // array: picking a district now flies the camera to that district's own
  // tower bounds (tighter `maxZoom` than the state-wide fit, since a single
  // district is a much smaller area); clearing the selection (or first
  // entering a state) still fits the whole state's tower bounds as before.
  useEffect(() => {
    if (!enableFitBounds || groups.size === 0) return;

    if (selectedDistrict) {
      const selectedGroup = Array.from(groups.values()).find((g) => sameDistrict(g.canonicalName, selectedDistrict));
      if (selectedGroup && selectedGroup.points.length > 0) {
        const bounds = L.latLngBounds(selectedGroup.points);
        if (bounds.isValid()) {
          map.flyToBounds(bounds, { padding: [50, 50], duration: 0.6, maxZoom: 10 });
        }
        return;
      }
    }

    const points = Array.from(groups.values()).flatMap((g) => g.points);
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points);
    if (bounds.isValid()) {
      map.flyToBounds(bounds, { padding: [50, 50], duration: 0.6, maxZoom: 8 });
    }
  }, [map, enableFitBounds, groups, selectedDistrict]);

  return null;
}
