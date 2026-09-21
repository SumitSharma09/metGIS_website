import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { GeoJSON, useMap } from 'react-leaflet';
import type { Layer, LeafletMouseEvent, StyleFunction } from 'leaflet';
import { RISK_COLOR, NO_DATA_COLOR, type RiskLevel } from '@/utils/severity';
import { normalizeName, type DistrictRiskInfo } from '@/utils/districtRisk';
import {
  extractNames,
  canonicalDistrictName,
  type DistrictFeature,
  type DistrictFeatureCollection,
} from '../districtGeo';

export type { DistrictRiskInfo };

// `selectedDistrict` can come from two different sources that don't always
// agree on spelling/case: a map click sets it from `info.rawName` (the
// boundary file's own canonical spelling), but the State/District dropdown
// (MapControls.tsx) sets it from `useListDistrictsQuery` - the real DB
// `Site.district` value, exactly as stored (e.g. real telecom/tower data is
// commonly all-uppercase, "ARIYALUR", while the Census boundary file spells
// it "Ariyalur"). A plain `===` comparison treats those as different
// districts, so picking a district from the dropdown silently failed to
// highlight or zoom to it whenever its DB spelling/case differed from the
// boundary file's - the risk COLOR still showed fine (that lookup already
// went through normalizeName via `districtRisk`), so only the selection
// highlight and the map's fitBounds camera looked broken. Comparing through
// the same `normalizeName` used everywhere else in this file fixes both.
function sameDistrict(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return normalizeName(a) === normalizeName(b);
}

interface DistrictLayerProps {
  stateName: string;
  features: DistrictFeature[];
  /** Keyed by normalizeName(canonical district name). */
  districtRisk: Map<string, DistrictRiskInfo>;
  /** Which color family fills the polygons - defaults to the generic
   *  red/orange/yellow/green scale. Callers colorizing a specific map
   *  layer (e.g. Live Map's currently active parameter) pass that layer's
   *  own palette (`LAYER_COLORS[layer]`, from `mapLayers.ts`) so the
   *  choropleth's hue matches its legend and site markers. */
  colors?: Record<RiskLevel, string>;
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
}

export function DistrictLayer({
  stateName,
  features,
  districtRisk,
  colors = RISK_COLOR,
  selectedDistrict,
  selectedTehsil,
  onSelectDistrict,
  enableFitBounds,
}: DistrictLayerProps) {
  const collection: DistrictFeatureCollection = useMemo(
    () => ({ type: 'FeatureCollection', features }),
    [features]
  );

  const lookup = useMemo(() => {
    return (feature: DistrictFeature): DistrictRiskInfo & { rawName: string; claimedNotAdministered: boolean } | null => {
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
          `[DistrictLayer] "${info.canonicalName}" has ${info.siteCount} monitored site(s) but didn't match any polygon in ${stateName}'s boundary file. Add an alias in src/pages/live-map/districtGeo.ts if this is a spelling mismatch.`
        );
      }
    });
  }, [features, districtRisk, stateName]);

  const style: StyleFunction<Record<string, unknown>> = (feature) => {
    if (!feature) return {};
    const info = lookup(feature as DistrictFeature);
    const isMonitored = (info?.siteCount ?? 0) > 0;
    const isSelected = sameDistrict(info?.rawName, selectedDistrict);
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
      fillColor: isMonitored ? colors[info!.risk] : NO_DATA_COLOR,
      fillOpacity: isSelected ? 0.85 : isMonitored ? 0.65 : 0.35,
    };
  };

  const onEachFeature = (feature: DistrictFeature, layer: Layer) => {
    const info = lookup(feature);
    if (!info) return;
    // Only the selected district actually got its color/count narrowed down
    // to the picked tehsil (see LiveMapPage's districtRiskScopeSites) - the
    // tooltip says so here, rather than every district in this state
    // claiming a tehsil scope that only applies to the one that's selected.
    const tehsilNote =
      selectedTehsil && sameDistrict(info.rawName, selectedDistrict) ? ` &middot; Tehsil: ${selectedTehsil}` : '';
    const scopeSuffix = tehsilNote ? ' in this tehsil' : '';
    const siteNoun = info.siteCount === 1 ? 'site' : 'sites';
    // Names the state too, not just the district - the state's own outline
    // is now highlighted on the map (see StateBoundaryLayer), but a hover
    // tooltip is still the clearest place to spell out which state a given
    // district belongs to. Just the circle/state name, the district name,
    // and its monitored-tower count - no averaged reading (dropped per
    // explicit request: the tooltip is a location+count summary, not a data
    // readout - color alone conveys severity now).
    const heading = `<strong>${info.rawName}</strong> &middot; ${stateName}`;
    const label = info.claimedNotAdministered
      ? `${heading}<br/>Claimed on India's official map; not under Indian administration`
      : info.siteCount > 0
        ? `${heading}${tehsilNote}<br/>${info.siteCount} monitored ${siteNoun}${scopeSuffix}`
        : `${heading}${tehsilNote}<br/>No monitored sites${scopeSuffix}`;
    layer.bindTooltip(label, { sticky: true, direction: 'top' });

    // A hover tooltip disappears the moment the pointer leaves, so it's not
    // enough for "show a popup with the selected district information" -
    // this is the persistent one, opened on click (Leaflet's default for
    // any layer with a bound popup) and kept in sync with picks made via
    // the State/District dropdowns instead of a map click (see the
    // `openPopup()` call below).
    const riskLabel = info.risk === 'none' ? 'No data' : info.risk.charAt(0).toUpperCase() + info.risk.slice(1);
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
        <div style="font-size:11.5px;color:#666;margin-bottom:6px;">${stateName}${tehsilNote}</div>
        <div style="font-size:12px;line-height:1.5;">
          ${info.siteCount > 0 ? `${info.siteCount} monitored ${siteNoun}${scopeSuffix}` : `No monitored sites${scopeSuffix}`}<br/>
          Risk level: <strong>${riskLabel}</strong>
        </div>
      </div>
    `;
    layer.bindPopup(popupHtml);

    layer.on('click', (e: LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      onSelectDistrict(info.rawName, stateName);
    });
    layer.on('mouseover', () => (layer as L.Path).setStyle({ weight: 3 }));
    layer.on('mouseout', () => (layer as L.Path).setStyle({ weight: sameDistrict(selectedDistrict, info.rawName) ? 3 : 1 }));

    // The whole GeoJSON layer re-keys (see the `key` prop below) whenever
    // `selectedDistrict` changes, so this only runs once for the newly
    // selected feature - safe to open unconditionally rather than fighting
    // any previous popup state.
    if (sameDistrict(selectedDistrict, info.rawName)) {
      layer.openPopup();
    }
  };

  return (
    <>
      <GeoJSON
        key={`${stateName}-${riskFingerprint}-${selectedDistrict ?? ''}-${selectedTehsil ?? ''}`}
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
  lookup: (feature: DistrictFeature) => (DistrictRiskInfo & { rawName: string }) | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (features.length === 0) return;
    const focusFeature = selectedDistrict
      ? features.find((f) => sameDistrict(lookup(f)?.rawName, selectedDistrict))
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
