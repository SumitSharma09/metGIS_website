import { GeoJSON } from 'react-leaflet';
import type { PathOptions } from 'leaflet';
import { INDIA_OUTLINE_GEOJSON } from '../indiaOutlineGeo';

const OUTLINE_STYLE: PathOptions = {
  // A solid (not dashed - dashed reads as "disputed") deep-blue line, drawn
  // on every map in the app so the correct Survey-of-India national
  // boundary is always visible, independent of whatever the OSM/Esri
  // basemap tiles underneath happen to render for Kashmir/Arunachal
  // Pradesh (third-party tile providers often draw a different, disputed
  // line there instead of India's official one).
  color: '#0b3d91',
  weight: 2.25,
  opacity: 0.95,
  fill: false,
};

/**
 * The actual India national boundary, drawn on top of the basemap tiles.
 * See `indiaOutlineGeo.ts` for the data's provenance (Survey of India, via
 * Datameet) - this is what makes the boundary "as per Indian government
 * authorities" rather than whatever the tile provider drew.
 *
 * Deliberately non-interactive (no click/hover) and unfilled, so it never
 * competes with the district choropleth's own click handling or fill
 * colors - it's a pure visual overlay, always the same regardless of which
 * parameter/layer is selected.
 */
export function IndiaBoundaryOutline() {
  return <GeoJSON data={INDIA_OUTLINE_GEOJSON} style={OUTLINE_STYLE} interactive={false} />;
}
