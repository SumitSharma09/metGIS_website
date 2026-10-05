import { useMemo } from 'react';
import L from 'leaflet';
import { GeoJSON, useMap } from 'react-leaflet';
import type { Layer, LeafletMouseEvent, StyleFunction } from 'leaflet';
import { RISK_COLOR, NO_DATA_COLOR, MAP_RISK_LABEL, type RiskLevel } from '@/utils/severity';
import { normalizeName, type DistrictRiskInfo } from '@/utils/districtRisk';
import { formatDateTime } from '@/utils/formatters';
import type { MapLayer } from '../mapLayers';
import { buildWeatherTooltipHtml, WEATHER_TOOLTIP_CLASSNAME } from '../mapTooltip';
import '../mapTooltip.css';
import { extractStateName, type DistrictFeature, type DistrictFeatureCollection } from '../districtGeo';

interface StateOutlinesLayerProps {
  /** Real Survey-of-India state polygons (see districtGeo.ts's header),
   *  already narrowed by the caller to whichever states the signed-in user
   *  is scoped to see. */
  features: DistrictFeature[];
  onSelectState: (stateName: string) => void;
  /** Keyed by normalizeName(state name) - see districtRisk.ts's
   *  buildStateRiskIndex. Optional so this layer still renders (as plain,
   *  uncolored outlines) for any caller that hasn't wired risk data up. */
  stateRisk?: Map<string, DistrictRiskInfo>;
  /** Which color family fills the polygons - defaults to the generic
   *  red/orange/yellow/green scale. The Live Map passes the currently
   *  active parameter's own palette (`LAYER_COLORS[layer]`) so this view's
   *  colors match the legend and site markers, exactly like DistrictLayer. */
  colors?: Record<RiskLevel, string>;
  /** normalizeName(real state name) -> the actual raw `Site.state` (circle)
   *  value to filter by, built from the full site list (see
   *  `buildStateSourceMap` in districtRisk.ts). Used INSTEAD OF `info.sourceValue`
   *  on click, since that value is only reliable when the clicked state
   *  currently has a live-observed site - this map is always correct as
   *  soon as the site list itself has loaded, so clicking a state always
   *  resolves to a circle value real records actually carry. */
  stateSourceMap?: Map<string, string>;
  /** Which parameter is currently active on the map - drives the reading
   *  shown in the hover tooltip below (e.g. "Wind speed: 14.2 km/h"), via
   *  `stateRisk`'s own `avgValue`/`avgDirectionDegrees` (a real average of
   *  that layer's reading across this state's monitored sites - see
   *  buildStateRiskIndex's `valueFn`/`directionValueFn` in LiveMapPage).
   *  Optional so other callers that don't pass a `layer` keep the plain
   *  monitored-count/risk-level tooltip unchanged. Added 2026-09-22 so the
   *  default nationwide view's tooltip matches DistrictLayer's. */
  layer?: MapLayer;
  /** Optional override for a monitored state's fill color, given its risk
   *  info - the Live Map passes a continuous value-based gradient (see
   *  LiveMapPage's `getFillColor`/`colorForValue` in mapLayers.ts) so
   *  hour-to-hour changes are visible even while every reading stays
   *  inside the "none" band. Omitted by other callers (FloodMap, HazardMap,
   *  RegionRiskMap), which keep the plain discrete `colors[info.risk]`
   *  fill unchanged. */
  getFillColor?: (info: DistrictRiskInfo) => string;
  /** ISO instant this render's observations were fetched "as of" - see
   *  DistrictLayer.tsx's matching prop doc comment for the full rationale
   *  (added 2026-09-23, "in live-map is hourly data mention the time
   *  okay"). The Live Map passes its shared `useMapTimeline().at`. */
  asOf?: string;
}

const STATE_STROKE = '#0f172a';
const STATE_STROKE_SELECTED = '#2563eb';

/**
 * The Live Map's default view: Indian state boundaries, colored by each
 * state's own worst current risk (for whichever parameter is active) once
 * risk data is supplied - so scrubbing the timeline's hourly slider visibly
 * changes every state's color, not just the district-level view you get
 * after drilling into one state (DistrictLayer). This used to render every
 * state with the same flat, uncolored fill (a deliberate choice to avoid a
 * Pan-India *district* choropleth by default - see districtGeo.ts's header
 * for the compliance reasoning that drove that). Coloring at the *state*
 * level, one level coarser than that original concern, was added back on
 * explicit request so the demo dataset's hour-to-hour changes are visible
 * at a glance across the whole country, not just one state at a time.
 *
 * Picking a state - by clicking it here, or via MapControls' State
 * dropdown - hands off to DistrictLayer for that one state's actual
 * district-level detail and choropleth.
 */
export function StateOutlinesLayer({
  features,
  onSelectState,
  stateRisk,
  colors = RISK_COLOR,
  stateSourceMap,
  // Aliased to `mapLayer` for the same reason as DistrictLayer's own prop of
  // this name - `onEachFeature` below has its own Leaflet `layer: Layer`
  // parameter, which would otherwise shadow this prop.
  layer: mapLayer,
  getFillColor,
  asOf,
}: StateOutlinesLayerProps) {
  const map = useMap();

  const collection: DistrictFeatureCollection = useMemo(
    () => ({ type: 'FeatureCollection', features }),
    [features]
  );

  const lookup = (feature: DistrictFeature): (DistrictRiskInfo & { rawName: string }) | null => {
    const name = extractStateName(feature);
    if (!name) return null;
    const info = stateRisk?.get(normalizeName(name));
    return { ...(info ?? { risk: 'none' as RiskLevel, siteCount: 0, canonicalName: name }), rawName: name };
  };

  // Re-key whenever the risk coloring should change (a new hour/day picked
  // on the timeline, a different map layer/parameter selected, or the risk
  // data itself finishing a fetch) - same reasoning as DistrictLayer's own
  // `riskFingerprint`: react-leaflet's GeoJSON only reacts to a handful of
  // props automatically, so without re-keying, `style`/tooltips would keep
  // showing whatever they first rendered with.
  const riskFingerprint = useMemo(() => {
    if (!stateRisk) return 'no-data';
    // Includes avgValue (rounded to 1dp) alongside risk - two hours can
    // share the same risk band (e.g. 36°C and 38°C are both "watch") but
    // still need the tooltip's actual number to refresh, since that's now
    // shown too (see valueLine below).
    return Array.from(stateRisk.entries())
      .map(
        ([name, info]) =>
          `${name}:${info.risk}:${info.avgValue?.toFixed(1) ?? ''}:${info.avgDirectionDegrees?.toFixed(0) ?? ''}:${info.avgGust?.toFixed(1) ?? ''}`
      )
      .join('|');
  }, [stateRisk]);

  const isMonitored = (info: DistrictRiskInfo) => info.siteCount > 0;

  const style: StyleFunction<Record<string, unknown>> = (feature) => {
    if (!feature) return {};
    const info = lookup(feature as DistrictFeature);
    if (!info) return {};
    const monitored = isMonitored(info);
    return {
      color: STATE_STROKE,
      weight: 1.5,
      opacity: 0.9,
      fillColor: monitored ? (getFillColor ? getFillColor(info) : colors[info.risk]) : NO_DATA_COLOR,
      fillOpacity: monitored ? 0.55 : 0.2,
    };
  };

  const onEachFeature = (feature: DistrictFeature, layer: Layer) => {
    const info = lookup(feature);
    if (!info) return;
    const monitored = isMonitored(info);
    const riskLabel = MAP_RISK_LABEL[info.risk];
    // `sourceValue` is the site's own raw, UNSPLIT `state` (circle) value
    // (e.g. "Bihar & Jharkhand"), which for a combined circle differs from
    // this polygon's own real-state name (`rawName`, e.g. "Bihar") - noting
    // that in the tooltip explains why the neighboring state's polygon shows
    // the exact same figures, rather than that looking like a bug.
    // `canonicalName` is NOT used here - for buildStateRiskIndex it's just
    // the split name (same as `rawName` for a monitored entry), never the
    // original combined circle value.
    const circleNote =
      monitored && info.sourceValue && normalizeName(info.sourceValue) !== normalizeName(info.rawName)
        ? `(&ldquo;${info.sourceValue}&rdquo; circle)`
        : undefined;
    // Risk level only - wind's own Direction/Gust rows (added 2026-09-22,
    // "i need seperate index of wing speed and directions and gust") were
    // removed 2026-09-24 per an explicit follow-up ("if i click wind they
    // mouse show me data remove name as well data in mouse over"): both the
    // row label ("Direction"/"Gust") and its value are gone now, not just
    // one or the other, so Wind's hover tooltip matches every other
    // parameter's (Risk level only). The averaged reading itself (e.g. a
    // bare "27.8°C") was already removed entirely 2026-09-24 - see
    // DistrictLayer.tsx's matching comment for that exact request ("remove
    // the data also"). The "Monitored towers" count row was removed the same
    // day too, per a direct follow-up ("in live-map default map show mouse
    // over monitorned towers - remove this also") - this hover fires on the
    // DEFAULT nationwide map (every state's own outline, before any state is
    // drilled into).
    const rows = monitored ? [{ label: 'Risk level', value: riskLabel }] : [];
    const accentColor = monitored ? (getFillColor ? getFillColor(info) : colors[info.risk]) : NO_DATA_COLOR;
    // "As likely of <date>, <time>" - see DistrictLayer.tsx's matching
    // comment (wording changed from "As of" 2026-09-23).
    const asOfLabel = asOf ? `As likely of ${formatDateTime(asOf)}` : undefined;
    const label = buildWeatherTooltipHtml({
      title: info.rawName,
      asOf: asOfLabel,
      note: circleNote,
      accentColor,
      rows,
      emptyText: monitored ? undefined : 'No monitored towers yet',
    });
    layer.bindTooltip(label, { sticky: true, direction: 'top', className: WEATHER_TOOLTIP_CLASSNAME });

    layer.on('click', (e: LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      // Resolve the ACTUAL raw DB `state` (circle) value to filter by, e.g.
      // "Bihar & Jharkhand" for a combined circle - NOT this polygon's own
      // real-state name (`rawName`, e.g. "Bihar") and NOT `canonicalName`.
      // Every REST query downstream (sites, observations, district
      // boundaries) filters by the real DB `state` value, so clicking the
      // Bihar half of a combined circle must still select "Bihar &
      // Jharkhand" as a whole - selecting "Bihar" alone filters for a value
      // no site actually has, silently returning zero towers/districts.
      // `stateSourceMap` (built from the full site list, not from
      // observations) is the reliable source for this - `info.sourceValue`
      // only exists when this polygon happens to have a live-observed site
      // at the current instant, so it's kept only as a fallback, with
      // `rawName` itself as the last resort for a genuinely unmonitored
      // state/UT (still selectable/clickable, just with no data to show).
      const resolved = stateSourceMap?.get(normalizeName(info.rawName)) ?? info.sourceValue ?? info.rawName;
      onSelectState(resolved);
      const bounds = (layer as L.Polygon).getBounds();
      if (bounds.isValid()) map.flyToBounds(bounds, { padding: [40, 40], duration: 0.6, maxZoom: 8 });
    });
    layer.on('mouseover', () => (layer as L.Path).setStyle({ weight: 2.75, color: STATE_STROKE_SELECTED }));
    layer.on('mouseout', () => (layer as L.Path).setStyle({ weight: 1.5, color: STATE_STROKE }));
  };

  return (
    <GeoJSON
      // `asOf` is appended to the key (2026-09-23) for the same reason as
      // DistrictLayer.tsx's matching key: the tooltip's new "As of <time>"
      // line needs to refresh every minute while parked on "now," even on
      // a minute where the underlying reading itself hasn't changed enough
      // to move `riskFingerprint`.
      key={`india-states-${features.length}-${riskFingerprint}-${asOf ?? ''}`}
      data={collection}
      style={style}
      onEachFeature={onEachFeature}
    />
  );
}
