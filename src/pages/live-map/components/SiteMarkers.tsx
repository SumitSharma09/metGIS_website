import { CircleMarker, Tooltip } from 'react-leaflet';
import type { Site } from '@/features/sites/types';
import type { CurrentObservation } from '@/features/weather/types';
import { layerReading, layerRisk, LAYER_COLORS, type MapLayer } from '../mapLayers';
import { formatWithUnit } from '@/utils/formatters';

interface SiteMarkersProps {
  sites: Site[];
  observations: Record<string, CurrentObservation>;
  layer: MapLayer;
  /** Opens the full "Weather details" side panel for this site - see
   *  WeatherDetailsPanel.tsx. Optional so this component still works
   *  anywhere a click-through panel doesn't make sense (none currently,
   *  but keeps this component's own tests/usages simple). */
  onSelectSite?: (site: Site) => void;
}

/** Per-site colored markers for the currently active layer. The animated,
 *  whole-map wind-flow visualization (the "arrows travelling" overlay) is
 *  a separate sibling layer - see `WindFlowLayer.tsx` - since it isn't
 *  tied to individual site positions the way these markers are. */
export function SiteMarkers({ sites, observations, layer, onSelectSite }: SiteMarkersProps) {
  return (
    <>
      {sites.map((site) => {
        const obs = observations[site.id];
        if (!obs) return null;
        return <SiteMarker key={site.id} site={site} obs={obs} layer={layer} onSelectSite={onSelectSite} />;
      })}
    </>
  );
}

function SiteMarker({
  site,
  obs,
  layer,
  onSelectSite,
}: {
  site: Site;
  obs: CurrentObservation;
  layer: MapLayer;
  onSelectSite?: (site: Site) => void;
}) {
  const risk = layerRisk(layer, obs, site);
  const reading = layerReading(layer, obs, site);
  const color = LAYER_COLORS[layer][risk];

  return (
    <CircleMarker
      center={[site.latitude, site.longitude]}
      radius={risk === 'none' ? 7 : 10}
      pathOptions={{
        color: '#ffffff',
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.9,
      }}
      eventHandlers={{
        click: () => onSelectSite?.(site),
      }}
    >
      {/* Hover-only quick glance - clicking opens the full Weather details
         side panel instead of a Leaflet popup, matching the reference
         product's persistent detail drawer rather than a floating bubble. */}
      <Tooltip direction="top" offset={[0, -8]}>
        <strong>{site.name}</strong>
        <br />
        {reading.label}: {formatWithUnit(reading.value, reading.unit)}
      </Tooltip>
    </CircleMarker>
  );
}
