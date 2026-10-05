import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { GeoJSON, useMap } from 'react-leaflet';
import type { Layer, LeafletMouseEvent, StyleFunction } from 'leaflet';
import { RISK_COLOR, NO_DATA_COLOR, MAP_RISK_LABEL, type RiskLevel } from '@/utils/severity';
import { normalizeName, type DistrictRiskInfo } from '@/utils/districtRisk';
import { formatDateTime } from '@/utils/formatters';
import type { MapLayer } from '../mapLayers';
import { buildWeatherTooltipHtml, WEATHER_TOOLTIP_CLASSNAME } from '../mapTooltip';
import '../mapTooltip.css';
import {
  extractNames,
  canonicalDistrictName,
  districtMatchesSelection,
  type DistrictFeature,
  type DistrictFeatureCollection,
} from '../districtGeo';

export type { DistrictRiskInfo };

// `selectedDistrict` can come from two different sources that don't always
// agree on spelling/case: a map click sets it from `info.rawName` (the
// boundary file's own canonical spelling), but the State/District dropdown
// (MapControls.tsx) sets it from `useListDistrictsReferenceQuery` - a raw
// value from the curated `indus_districts` reference table, exactly as
// stored (e.g. real telecom/tower data is commonly all-uppercase,
// "ARIYALUR", while the Census boundary file spells it "Ariyalur"). A plain
// `===` comparison treats those as different districts, so picking a
// district from the dropdown silently failed to highlight or zoom to it
// whenever its DB spelling/case differed from the boundary file's - the risk
// COLOR still showed fine (that lookup already went through normalizeName
// via `districtRisk`), so only the selection highlight and the map's
// fitBounds camera looked broken.
//
// UPDATE 2026-09-29 ("in live-map without click indus they not redirect"):
// a plain normalizeName comparison isn't enough for a district whose
// dropdown label has NO real polygon of its own at all (e.g. "Bilaspur
// (MPCG)" - an internal indus_districts duplicate for the real "Bilaspur"
// district, not a separate administrative place) - see
// `districtMatchesSelection` in districtGeo.ts, which this file now uses in
// place of a local `sameDistrict` helper: it does the same normalized exact
// match first, then falls back to a small selection-alias table for exactly
// this kind of known duplicate label.

interface DistrictLayerProps {
  /** The single state being viewed, e.g. "Tamil Nadu" or a combined circle
   *  like "Bihar & Jharkhand" - shown in every district's tooltip/popup
   *  subtitle and passed back on click via `onSelectDistrict`. Left
   *  undefined for a Pan-India nationwide render spanning MANY states at
   *  once (added 2026-09-30, "in nationwide they not show pleas echeck") -
   *  in that case each district's own real government state (`info.realState`,
   *  resolved per-feature from the boundary file itself) is used instead,
   *  both for display and for the click callback, so a nationwide click
   *  always drills into the CORRECT state rather than one fixed value that
   *  could never be right for every district on screen at once. */
  stateName?: string;
  features: DistrictFeature[];
  /** Keyed by normalizeName(canonical district name). */
  districtRisk: Map<string, DistrictRiskInfo>;
  /** Which color family fills the polygons - defaults to the generic
   *  red/orange/yellow/green scale. Callers colorizing a specific map
   *  layer (e.g. Live Map's currently active parameter) pass that layer's
   *  own palette (`LAYER_COLORS[layer]`, from `mapLayers.ts`) so the
   *  choropleth's hue matches its legend and site markers. */
  colors?: Record<RiskLevel, string>;
  /** Which parameter is currently active on the map - drives the reading
   *  shown in the hover tooltip below (e.g. "Temperature: 32.4°C"), via
   *  `districtRisk`'s own `avgValue` (a real average of that layer's
   *  reading across this district's monitored sites - see
   *  buildDistrictRiskIndex's `valueFn` in LiveMapPage). Optional so other
   *  callers (FloodMap, HazardMap, RegionRiskMap) that don't pass a `layer`
   *  keep the plain location-only tooltip unchanged. */
  layer?: MapLayer;
  selectedDistrict: string | null;
  /** When set, `selectedDistrict`'s own tooltip and coloring are already
   *  scoped down to just this tehsil by the caller (see LiveMapPage's
   *  `districtRiskScopeSites`) - this prop only adds a note to the tooltip
   *  so it's visible *why* that one district looks different, rather than
   *  narrowing anything itself. */
  selectedTehsil?: string | null;
  /** Called with the clicked district's canonical name AND its state, so a
   *  click while zoomed out (Pan-India, many states rendered at once) can
   *  drill down into the right state, not just set a district name. */
  onSelectDistrict: (districtName: string, stateName: string) => void;
  /** Only the layer for the currently "active" state should steer the
   *  map's camera - when many states are rendered at once (nothing picked
   *  yet), none of them should fight over `flyToBounds`. */
  enableFitBounds: boolean;
  /** Optional override for a monitored district's fill color, given its
   *  risk info - the Live Map passes a continuous value-based gradient
   *  (see LiveMapPage's `getFillColor`/`colorForValue` in mapLayers.ts) so
   *  hour-to-hour changes are visible even while every reading stays
   *  inside the "none" band. Omitted by other callers (FloodMap, HazardMap,
   *  RegionRiskMap), which keep the plain discrete `colors[info.risk]`
   *  fill unchanged. */
  getFillColor?: (info: DistrictRiskInfo) => string;
  /** ISO instant this render's observations were fetched "as of" - the Live
   *  Map's shared `useMapTimeline().at` value ("now," or wherever the
   *  timeline scrubber is parked). Added 2026-09-23 per explicit request
   *  ("in live-map is hourly data mention the time okay") so the hover
   *  tooltip states which hour's real reading it's showing, since every
   *  figure here is hourly data (see districtRisk.ts's own doc comments),
   *  not a live-updating value. Optional so other callers (FloodMap,
   *  HazardMap, RegionRiskMap) that don't track a timeline keep the
   *  time-free tooltip unchanged. */
  asOf?: string;
}

export function DistrictLayer({
  stateName,
  features,
  districtRisk,
  colors = RISK_COLOR,
  // Aliased to `mapLayer` - `onEachFeature` below already has its own
  // `layer: Layer` parameter (the Leaflet layer being styled), which would
  // otherwise shadow this prop of the same name.
  layer: mapLayer,
  selectedDistrict,
  selectedTehsil,
  onSelectDistrict,
  enableFitBounds,
  getFillColor,
  asOf,
}: DistrictLayerProps) {
  const collection: DistrictFeatureCollection = useMemo(
    () => ({ type: 'FeatureCollection', features }),
    [features]
  );

  const lookup = useMemo(() => {
    return (
      feature: DistrictFeature
    ): (DistrictRiskInfo & { rawName: string; realState: string; claimedNotAdministered: boolean }) | null => {
      const names = extractNames(feature);
      if (!names) return null;
      const canonical = canonicalDistrictName(names.district, names.state);
      const info = districtRisk.get(normalizeName(canonical));
      // Set by docs/generate_boundaries.py on exactly one feature: the
      // former J&K state's Census "Data Not Available" placeholder, i.e.
      // Pakistan-occupied Jammu and Kashmir (Gilgit-Baltistan and
      // Mirpur-Muzaffarabad) - claimed by India on its official map but not
      // under Indian administration, so it never has monitoring towers or
      // civic data the way an ordinary district does. Styled and labeled
      // distinctly below rather than left to look like an unremarkable
      // "no data yet" district.
      const claimedNotAdministered = feature.properties?.claimedNotAdministered === true;
      return {
        ...(info ?? { risk: 'none' as RiskLevel, siteCount: 0, canonicalName: canonical }),
        rawName: canonical,
        // This feature's own real government state (e.g. "Chhattisgarh"),
        // as the boundary file itself spells it - NOT the same as this
        // component's `stateName` prop, which can be a combined-circle
        // value ("Madhya Pradesh & Chhattisgarh") spanning two real states'
        // worth of merged features. Needed so `districtMatchesSelection`
        // can key its selection-alias lookup by the correct real state.
        realState: names.state,
        claimedNotAdministered,
      };
    };
  }, [districtRisk]);

  // Re-key the layer whenever the risk coloring should change, so Leaflet
  // rebuilds styles/tooltips instead of reusing stale ones (react-leaflet's
  // GeoJSON only reacts to a handful of props automatically).
  // Includes avgValue (rounded to 1dp) alongside risk, same reasoning as
  // StateOutlinesLayer's own fingerprint: two hours can share a risk band
  // (36°C and 38°C are both "watch") but the tooltip's actual number still
  // needs to refresh between them.
  const riskFingerprint = useMemo(
    () =>
      Array.from(districtRisk.entries())
        .map(([name, info]) => `${name}:${info.risk}:${info.avgValue?.toFixed(1) ?? ''}`)
        .join('|'),
    [districtRisk]
  );

  // Dev-only sanity check: warn about any monitored district that never
  // matched a polygon in this state's boundary file, so a naming mismatch
  // (add it to DISTRICT_ALIASES in districtGeo.ts) is easy to spot instead
  // of silently rendering as an unremarkable gray "no data" district.
  useEffect(() => {
    if (!import.meta.env.DEV || features.length === 0) return;
    const matched = new Set(
      features.map((f) => {
        const names = extractNames(f);
        return names ? normalizeName(canonicalDistrictName(names.district, names.state)) : null;
      })
    );
    districtRisk.forEach((info, key) => {
      if (info.siteCount > 0 && !matched.has(key)) {
        // eslint-disable-next-line no-console
        console.warn(
          `[DistrictLayer] "${info.canonicalName}" has ${info.siteCount} monitored site(s) but didn't match any polygon in ${stateName ?? 'the nationwide'} boundary file. Add an alias in src/pages/live-map/districtGeo.ts if this is a spelling mismatch.`
        );
      }
    });
  }, [features, districtRisk, stateName]);

  const style: StyleFunction<Record<string, unknown>> = (feature) => {
    if (!feature) return {};
    const info = lookup(feature as DistrictFeature);
    const isMonitored = (info?.siteCount ?? 0) > 0;
    const isSelected = districtMatchesSelection(info?.rawName, info?.realState, selectedDistrict);
    if (info?.claimedNotAdministered) {
      // Distinguishable from an ordinary "no data yet" gray district (a
      // dashed outline plus a flatter, more muted fill) so it doesn't read
      // as a monitoring gap this app could plausibly close - see the note
      // on `claimedNotAdministered` above for why it never will.
      return {
        color: isSelected ? '#2563eb' : '#64748b',
        weight: isSelected ? 3 : 1.25,
        opacity: isSelected ? 1 : 0.7,
        dashArray: isSelected ? undefined : '4 3',
        fillColor: '#94a3b8',
        fillOpacity: isSelected ? 0.6 : 0.25,
      };
    }
    return {
      // A translucent white line all but disappeared against the light
      // default OSM "street" basemap (and was faint on satellite imagery
      // too) - a dark, mostly-opaque stroke reads as a clear district
      // outline on every basemap, while the bright blue selected outline
      // still stands out from it.
      color: isSelected ? '#2563eb' : '#0f172a',
      weight: isSelected ? 3 : 1.25,
      opacity: isSelected ? 1 : 0.8,
      fillColor: isMonitored ? (getFillColor ? getFillColor(info!) : colors[info!.risk]) : NO_DATA_COLOR,
      fillOpacity: isSelected ? 0.85 : isMonitored ? 0.65 : 0.35,
    };
  };

  const onEachFeature = (feature: DistrictFeature, layer: Layer) => {
    const info = lookup(feature);
    if (!info) return;
    // Only the selected district actually got its color/count narrowed down
    // to the picked tehsil (see LiveMapPage's districtRiskScopeSites) - the
    // popup (below) says so, rather than every district in this state
    // claiming a tehsil scope that only applies to the one that's selected.
    const tehsilNote =
      selectedTehsil && districtMatchesSelection(info.rawName, info.realState, selectedDistrict)
        ? `Tehsil: ${selectedTehsil}`
        : undefined;
    const isMonitored = (info.siteCount ?? 0) > 0;
    // The HOVER tooltip is district + state, plus the active parameter's own
    // reading for this district (per later explicit request - "show only
    // district name with state name and parameter and their data",
    // superseding the earlier location-only decision described above for
    // this tooltip). `info.avgValue` is a genuine average of real
    // observations across this district's monitored sites (see
    // buildDistrictRiskIndex's valueFn in LiveMapPage) - never fabricated -
    // so it's simply omitted (not shown as N/A or "no data") when the
    // district has no monitored reading at all, keeping the tooltip
    // location-only in that case same as before.
    //
    // A "Risk level" row was added FIRST (2026-09-23 - "if i click the wind
    // they do not show index based on condtions"): `info.risk` is the same
    // none/watch/alert/warning classification (`layerRisk`, threshold bands
    // in severity.ts/LAYER_LEGEND) that already drives this polygon's own
    // fill color - previously that classification was only ever conveyed
    // by color, with no text label naming it. `MAP_RISK_LABEL` is the same
    // lookup StateOutlinesLayer's tooltip already uses for this, so a
    // district and a state hover read the risk the same way. Gated on
    // `mapLayer`, so a caller with no active parameter (FloodMap/HazardMap/
    // RegionRiskMap) keeps its existing location-only tooltip unchanged.
    //
    // The active parameter's own averaged reading (e.g. a bare "27.8°C") was
    // removed from here entirely on 2026-09-24, per an explicit follow-up
    // request ("you remove the parameter name not data why??? please remove
    // the data also") - an earlier same-day change had already dropped just
    // the row's label, but the raw figure is gone now too.
    //
    // Wind's own extra Direction/Gust rows (added 2026-09-22, "i need
    // seperate index of wing speed and directions and gust") were removed
    // the same day (2026-09-24) per a further explicit follow-up ("if i
    // click wind they mouse show me data remove name as well data in mouse
    // over"): both the row label and its value are gone now, so Wind's
    // hover tooltip for a monitored district shows only "Risk level", the
    // same as every other parameter.
    const rows =
      mapLayer && isMonitored ? [{ label: 'Risk level', value: MAP_RISK_LABEL[info.risk] }] : [];
    const accentColor = info.claimedNotAdministered
      ? '#94a3b8'
      : isMonitored
        ? getFillColor
          ? getFillColor(info)
          : colors[info.risk]
        : NO_DATA_COLOR;
    // "As likely of <date>, <time>" - see mapTooltip.ts's `asOf` doc
    // comment. Wording changed from "As of" to "As likely of" 2026-09-23
    // per explicit request ("As of = As likely of"), since the hour shown
    // here is `useMapTimeline`'s `displayAt` - rounded FORWARD to the next
    // clean hour in live "Today" mode, not the exact instant the underlying
    // reading is really from (see that hook's own doc comment) - "As likely
    // of" reads as the applicable/upcoming hour bucket rather than
    // overclaiming the reading was measured at that literal instant.
    const asOfLabel = asOf ? `As likely of ${formatDateTime(asOf)}` : undefined;
    const label = buildWeatherTooltipHtml({
      title: info.rawName,
      subtitle: stateName ?? info.realState,
      asOf: asOfLabel,
      note: tehsilNote,
      accentColor,
      rows,
    });
    layer.bindTooltip(label, { sticky: true, direction: 'top', className: WEATHER_TOOLTIP_CLASSNAME });

    // A hover tooltip disappears the moment the pointer leaves, so it's not
    // enough for "show a popup with the selected district information" -
    // this is the persistent one, opened on click (Leaflet's default for
    // any layer with a bound popup) and kept in sync with picks made via
    // the State/District dropdowns instead of a map click (see the
    // `openPopup()` call below).
    // Click popup is now the same location-only label as the hover tooltip -
    // per explicit request, the monitored-site-count/risk-level readout is
    // removed here too (it used to be shown on click, keeping the hover
    // tooltip location-only per an earlier request - now both are
    // location-only, and the fill color alone conveys severity). The
    // claimedNotAdministered explanation is kept, since that's not a
    // site-count/risk reading - it's the reason this one area has neither.
    const popupHtml = info.claimedNotAdministered
      ? `
      <div style="min-width:200px">
        <div style="font-weight:700;font-size:13px;margin-bottom:2px;">${info.rawName}</div>
        <div style="font-size:11.5px;color:#666;margin-bottom:6px;">${stateName}</div>
        <div style="font-size:12px;line-height:1.5;">
          Shown within India's official boundary but not under Indian civic administration, so no monitoring towers, census, or risk data exist for it.
        </div>
      </div>
    `
      : `
      <div style="min-width:170px">
        <div style="font-weight:700;font-size:13px;margin-bottom:2px;">${info.rawName}</div>
        <div style="font-size:11.5px;color:#666;">${stateName ?? info.realState}${tehsilNote}</div>
      </div>
    `;
    layer.bindPopup(popupHtml);

    layer.on('click', (e: LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      onSelectDistrict(info.rawName, stateName ?? info.realState);
    });
    layer.on('mouseover', () => (layer as L.Path).setStyle({ weight: 3 }));
    layer.on('mouseout', () =>
      (layer as L.Path).setStyle({
        weight: districtMatchesSelection(info.rawName, info.realState, selectedDistrict) ? 3 : 1,
      })
    );

    // The whole GeoJSON layer re-keys (see the `key` prop below) whenever
    // `selectedDistrict` changes, so this only runs once for the newly
    // selected feature - safe to open unconditionally rather than fighting
    // any previous popup state.
    if (districtMatchesSelection(info.rawName, info.realState, selectedDistrict)) {
      layer.openPopup();
    }
  };

  return (
    <>
      {/* `asOf` is appended to the key (2026-09-23) so the tooltip's new
          "As of <time>" line stays accurate: while parked on "now," `asOf`
          ticks every minute even when the underlying hourly reading (and so
          `riskFingerprint`) hasn't changed - without this, the GeoJSON
          wouldn't remount and the displayed time would freeze at whatever
          it first rendered. */}
      <GeoJSON
        key={`${stateName ?? 'nationwide'}-${riskFingerprint}-${mapLayer ?? ''}-${selectedDistrict ?? ''}-${selectedTehsil ?? ''}-${asOf ?? ''}`}
        data={collection}
        style={style}
        onEachFeature={onEachFeature}
      />
      {enableFitBounds && (
        <FitBoundsToState features={features} selectedDistrict={selectedDistrict} lookup={lookup} />
      )}
    </>
  );
}

/** Zooms/pans the map to the selected state's districts, and refines to a
 *  single district's bounds when one is selected (from either the dropdown
 *  filter or a click on the map itself - both flow through the same
 *  `selectedDistrict` value, which is what keeps the two in sync). */
function FitBoundsToState({
  features,
  selectedDistrict,
  lookup,
}: {
  features: DistrictFeature[];
  selectedDistrict: string | null;
  lookup: (feature: DistrictFeature) => (DistrictRiskInfo & { rawName: string; realState: string }) | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (features.length === 0) return;
    // This is the actual camera redirect for a district picked from the
    // dropdown (or clicked on the map) - see districtMatchesSelection's own
    // doc comment (districtGeo.ts) for why a plain normalizeName match isn't
    // enough for a label like "Bilaspur(MPCG)" that has no polygon of its
    // own. Before this fix, `focusFeature` was always `undefined` for such a
    // label, so this silently fell through to fitting the WHOLE state's
    // bounds instead of the (non-existent) specific district - which is
    // exactly the reported "does not redirect" symptom.
    const focusFeature = selectedDistrict
      ? features.find((f) => {
          const info = lookup(f);
          return districtMatchesSelection(info?.rawName, info?.realState, selectedDistrict);
        })
      : undefined;

    const target = focusFeature ? [focusFeature] : features;
    const bounds = L.geoJSON({ type: 'FeatureCollection', features: target } as GeoJSON.GeoJsonObject).getBounds();
    if (bounds.isValid()) {
      map.flyToBounds(bounds, { padding: [50, 50], duration: 0.6, maxZoom: focusFeature ? 10 : 8 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features, selectedDistrict]);

  return null;
}
