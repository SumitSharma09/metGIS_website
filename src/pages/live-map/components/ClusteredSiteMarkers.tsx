import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type { Site } from '@/features/sites/types';
import type { CurrentObservation } from '@/features/weather/types';
import { layerReading, layerRisk, LAYER_COLORS, type MapLayer } from '../mapLayers';
import { formatWithUnit } from '@/utils/formatters';

// Shown for a tower whose live weather wasn't loaded - see LiveMapPage's
// WEATHER_FETCH_LIMIT: above that many towers in view, weather observations
// aren't fetched at all (each one costs a separate DB round trip server-side
// - see WeatherService.currentFor - so doing this for the full 57k+ network
// would fire tens of thousands of sequential queries in one request). The
// tower still gets a pin, just an uncolored one, rather than disappearing.
const NEUTRAL_COLOR = '#9e9e9e';

interface ClusteredSiteMarkersProps {
  sites: Site[];
  observations: Record<string, CurrentObservation>;
  layer: MapLayer;
  onSelectSite?: (site: Site) => void;
}

/**
 * Renders every site as a clustered marker via `leaflet.markercluster`
 * instead of one react-leaflet `<CircleMarker>` per site (the older
 * `SiteMarkers.tsx`, still used anywhere the site count stays small). Once
 * this app's network grew to the real `INDUS_CIRCLES` data (57,000+ real
 * towers), rendering that many individual SVG markers froze the browser
 * outright. `leaflet.markercluster` groups nearby towers into a single
 * numbered bubble that splits apart as you zoom in - the standard fix at
 * this scale, and how every major "many thousands of points" map product
 * handles it.
 *
 * Needs the `leaflet.markercluster` package (`npm install
 * leaflet.markercluster @types/leaflet.markercluster`) - this component
 * can't render without it.
 *
 * Implemented imperatively (a plain `L.markerClusterGroup()` managed via
 * `useMap()`) rather than through a React wrapper package, since
 * `leaflet.markercluster` predates react-leaflet's plugin conventions and
 * this keeps the integration simple and dependency-light.
 */
export function ClusteredSiteMarkers({ sites, observations, layer, onSelectSite }: ClusteredSiteMarkersProps) {
  const map = useMap();
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);

  // Create the cluster group layer once per map instance.
  useEffect(() => {
    const group = L.markerClusterGroup({
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      // Below this zoom, individual towers spread out enough (and their
      // count drops low enough - district-level, typically) that showing
      // them uncluster is more useful than one more cluster bubble.
      disableClusteringAtZoom: 11,
    });
    clusterGroupRef.current = group;
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
      clusterGroupRef.current = null;
    };
  }, [map]);

  // Rebuild the marker set whenever the site list, weather data, or the
  // active layer changes - clearLayers()+re-add is simpler and plenty fast
  // here (the expensive part is the network's size, not re-creating
  // lightweight circle markers), and avoids tracking per-marker diffs.
  useEffect(() => {
    const group = clusterGroupRef.current;
    if (!group) return;
    group.clearLayers();

    sites.forEach((site) => {
      const obs = observations[site.id];
      const risk = obs ? layerRisk(layer, obs, site) : 'none';
      const color = obs ? LAYER_COLORS[layer][risk] : NEUTRAL_COLOR;

      const marker = L.circleMarker([site.latitude, site.longitude], {
        radius: risk === 'none' ? 6 : 9,
        color: '#ffffff',
        weight: 1.2,
        fillColor: color,
        fillOpacity: 0.9,
      });

      const reading = obs ? layerReading(layer, obs, site) : null;
      const readingLine = reading
        ? `${reading.label}: ${formatWithUnit(reading.value, reading.unit)}`
        : 'No live weather loaded - select this circle/district to load it';
      marker.bindTooltip(`<strong>${site.name}</strong><br/>${readingLine}`, {
        direction: 'top',
        offset: [0, -8],
      });

      if (onSelectSite) {
        marker.on('click', () => onSelectSite(site));
      }

      group.addLayer(marker);
    });
  }, [sites, observations, layer, onSelectSite]);

  return null;
}
