import { useMemo } from 'react';
import L from 'leaflet';
import { GeoJSON, useMap } from 'react-leaflet';
import type { Layer, LeafletMouseEvent, StyleFunction } from 'leaflet';
import { RISK_COLOR, NO_DATA_COLOR, MAP_RISK_LABEL, type RiskLevel } from '@/utils/severity';
import { normalizeName, type DistrictRiskInfo } from '@/utils/districtRisk';
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
      .map(([name, info]) => `${name}:${info.risk}:${info.avgValue?.toFixed(1) ?? ''}`)
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
      fillColor: monitored ? colors[info.risk] : NO_DATA_COLOR,
      fillOpacity: monitored ? 0.55 : 0.2,
    };
  };

  const onEachFeature = (feature: DistrictFeature, layer: Layer) => {
    const info = lookup(feature);
    if (!info) return;
    const monitored = isMonitored(info);
    const siteNoun = info.siteCount === 1 ? 'tower' : 'towers';
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
        ? ` <span style="opacity:.75">(“${info.sourceValue}” circle)</span>`
        : '';
    // Just the circle/state name, its monitored-tower count, and a risk
    // word - no averaged reading here (see DistrictLayer's matching note:
    // dropped per explicit request, the tooltip is a location+count summary,
    // not a data readout).
    const label = monitored
      ? `<strong>${info.rawName}</strong>${circleNote}<br/>${info.siteCount} monitored ${siteNoun} &middot; ${riskLabel}`
      : `<strong>${info.rawName}</strong><br/>No monitored towers yet`;
    layer.bindTooltip(label, { sticky: true, direction: 'top' });

    layer.on('click', (e: LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      // Passes the site's own raw, UNSPLIT `state` (circle) value -
      // `sourceValue`, e.g. "Bihar & Jharkhand" - NOT this polygon's own
      // real-state name (`rawName`, e.g. "Bihar") and NOT `canonicalName`
      // (which for buildStateRiskIndex is just the split name, same as
      // `rawName`). Every REST query downstream (sites, observations,
      // district boundaries) filters by the real DB `state` value, so
      // clicking the Bihar half of a combined circle must still select
      // "Bihar & Jharkhand" as a whole - selecting "Bihar" alone would
      // filter for a value no site actually has, silently returning zero
      // towers. Falls back to `rawName` for an unmonitored polygon (no
      // sourceValue at all, since no site contributed one) so an empty
      // state is still selectable/clickable.
      onSelectState(info.sourceValue ?? info.rawName);
      const bounds = (layer as L.Polygon).getBounds();
      if (bounds.isValid()) map.flyToBounds(bounds, { padding: [40, 40], duration: 0.6, maxZoom: 8 });
    });
    layer.on('mouseover', () => (layer as L.Path).setStyle({ weight: 2.75, color: STATE_STROKE_SELECTED }));
    layer.on('mouseout', () => (layer as L.Path).setStyle({ weight: 1.5, color: STATE_STROKE }));
  };

  return (
    <GeoJSON
      key={`india-states-${features.length}-${riskFingerprint}`}
      data={collection}
      style={style}
      onEachFeature={onEachFeature}
    />
  );
}
