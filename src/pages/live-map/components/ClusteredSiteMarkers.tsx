import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type { Site } from '@/features/sites/types';
import type { CurrentObservation } from '@/features/weather/types';
import { layerReading, layerRisk, colorForValue, LAYER_COLORS, type MapLayer } from '../mapLayers';
import { buildWeatherTooltipHtml, WEATHER_TOOLTIP_CLASSNAME } from '../mapTooltip';
import '../mapTooltip.css';
import { formatDateTime } from '@/utils/formatters';
import { MAP_RISK_LABEL } from '@/utils/severity';

// Flat fallback fill for a tower with no live observation - not a "band"
// color computed from a reading (there isn't one), just a fixed neutral
// shade so the point is still visible on the map alongside colored towers.
const NO_DATA_COLOR = '#9e9e9e';

// Every real site in `sites` (i.e. every row this app pulled from
// indus_locations for the current scope) gets a point on the map, whether or
// not it has a live weather reading right now - restored 2026-09-22 per
// explicit request: "in live map i click tower then they not show me whole
// towers points in my table indus_location previous work. please correct."
// This reverses an earlier same-day change that hid any tower with no
// `hourly_weather` row at all (the common case - e.g. ARARIA district has
// 412 towers but only 3 with any real data) after a report that towers were
// showing up near Ladakh with no data behind them. That Ladakh report turned
// out to be a real-data district-boundary/aliasing issue (see the project's
// live-map-no-weather-loaded-fix doc), not a reason to hide undocumented
// towers - and hiding towers wholesale meant this view could no longer be
// used to see the network's actual, complete physical footprint. A tower
// with no observation renders with the same marker styling as one with data
// (see NO_DATA_COLOR below) - no special-cased "ghost" treatment, just one
// flat neutral fill since there's no reading to grade it by.

interface ClusteredSiteMarkersProps {
  sites: Site[];
  observations: Record<string, CurrentObservation>;
  layer: MapLayer;
  onSelectSite?: (site: Site) => void;
  /** ISO instant this render's observations were fetched "as of" - see
   *  DistrictLayer.tsx's matching prop doc comment for the full rationale
   *  (added 2026-09-23, "in live-map is hourly data mention the time
   *  okay"). The Live Map passes its shared `useMapTimeline().at`. */
  asOf?: string;
  /** Keyed by site id -> the REAL district that tower's own coordinates
   *  fall inside (see live-map/geoDistrict.ts's `resolveGeoDistricts`),
   *  which can differ from the site's own recorded `district` field. When
   *  provided, a marker's tooltip names this geography-resolved district
   *  instead of the stored one, so hovering a tower matches the same
   *  real-location attribution the district choropleth now colors by -
   *  added per explicit request ("group towers by their actual geographic
   *  location"). Optional, and falls back to `site.district`, for any
   *  caller/scope where boundary polygons aren't loaded yet (e.g. no state
   *  picked). */
  geoDistrictBySiteId?: Map<string, string>;
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
export function ClusteredSiteMarkers({
  sites,
  observations,
  layer,
  onSelectSite,
  asOf,
  geoDistrictBySiteId,
}: ClusteredSiteMarkersProps) {
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

    // "As likely of <date>, <time>" - see DistrictLayer.tsx's matching
    // comment (wording changed from "As of" 2026-09-23). Computed once
    // since it's identical for every marker.
    const asOfLabel = asOf ? `As likely of ${formatDateTime(asOf)}` : undefined;

    sites.forEach((site) => {
      const obs = observations[site.id];
      // The REAL district this tower's coordinates fall inside, when known
      // (see this component's own `geoDistrictBySiteId` doc comment) -
      // falls back to the site's own recorded field wherever boundary
      // polygons aren't loaded for the current scope.
      const districtLabel = geoDistrictBySiteId?.get(site.id) ?? site.district;

      // No live reading for this tower right now - still plot it (every
      // real row in indus_locations gets a point, see this file's header
      // comment), with the same circleMarker shape as a tower with data,
      // just filled with the flat NO_DATA_COLOR since there's nothing to
      // grade a shade from.
      if (!obs) {
        const marker = L.circleMarker([site.latitude, site.longitude], {
          radius: 6,
          color: '#ffffff',
          weight: 1.2,
          fillColor: NO_DATA_COLOR,
          fillOpacity: 0.9,
        });
        // Location-only tooltip, same as the "has data" branch below, minus
        // the parameter line (there's nothing real to show) - per explicit
        // request, the hover no longer names the tower or says "no live
        // weather data" at all, just where it is.
        marker.bindTooltip(
          buildWeatherTooltipHtml({
            title: districtLabel,
            subtitle: site.state,
            asOf: asOfLabel,
            accentColor: NO_DATA_COLOR,
            rows: [],
          }),
          {
            direction: 'top',
            offset: [0, -8],
            className: WEATHER_TOOLTIP_CLASSNAME,
          }
        );
        if (onSelectSite) {
          marker.on('click', () => onSelectSite(site));
        }
        group.addLayer(marker);
        return;
      }

      const risk = layerRisk(layer, obs, site);
      // Continuous shade from this tower's own reading, not just the flat
      // 4-band color - see mapLayers.ts's colorForValue for why: most real
      // Indian weather sits inside the "none" band all week, so the plain
      // band color barely ever changed as the timeline's hourly slider
      // moved even though the tower's actual reading was.
      const color = colorForValue(layer, LAYER_COLORS[layer], layerReading(layer, obs, site).value, risk);

      const marker = L.circleMarker([site.latitude, site.longitude], {
        radius: risk === 'none' ? 6 : 9,
        color: '#ffffff',
        weight: 1.2,
        fillColor: color,
        fillOpacity: 0.9,
      });

      // Tooltip is location + parameter/data only - district name and state
      // name, then the active layer's reading - per explicit request; the
      // tower's own name is no longer shown at all (the district+state pair
      // is what the request asks the hover to identify by).
      //
      // A "Risk level" row was added (2026-09-23 - "if i click the
      // wind they do not show index based on condtions"): `risk` (computed
      // just above) is the same none/watch/alert/warning classification
      // that already drives this marker's own fill color/size - previously
      // only conveyed by color, with no text label naming it. Same
      // `MAP_RISK_LABEL` lookup DistrictLayer/StateOutlinesLayer use, so
      // every hover surface names the risk the same way.
      // `reading` itself (the active parameter's raw value, e.g. a bare
      // "27.8°C") is computed here but deliberately left OUT of `rows` below
      // as of 2026-09-24 - removed per an explicit follow-up request
      // ("remove the data also") on top of an earlier same-day change that
      // had only dropped its label.
      //
      // Wind's own extra Direction/Gust rows (added 2026-09-22, "i need
      // seperate index of wing speed and directions and gust") were removed
      // the same day (2026-09-24) per a further explicit follow-up ("if i
      // click wind they mouse show me data remove name as well data in mouse
      // over"): both the row label and its value are gone now, so a tower's
      // Wind tooltip shows only "Risk level", the same as every other
      // parameter. See DistrictLayer.tsx's matching comment for the full
      // request text.
      const rows = [{ label: 'Risk level', value: MAP_RISK_LABEL[risk] }];
      marker.bindTooltip(
        buildWeatherTooltipHtml({
          title: districtLabel,
          subtitle: site.state,
          asOf: asOfLabel,
          accentColor: color,
          rows,
        }),
        {
          direction: 'top',
          offset: [0, -8],
          className: WEATHER_TOOLTIP_CLASSNAME,
        }
      );

      if (onSelectSite) {
        marker.on('click', () => onSelectSite(site));
      }

      group.addLayer(marker);
    });
  }, [sites, observations, layer, onSelectSite, asOf, geoDistrictBySiteId]);

  return null;
}
