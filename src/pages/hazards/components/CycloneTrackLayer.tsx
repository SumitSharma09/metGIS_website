import dayjs from 'dayjs';
import { Circle, CircleMarker, Tooltip } from 'react-leaflet';
import { CLASSIFICATION_COLOR } from './cycloneVisuals';
import { cycloneImpactRadiusKm, type CycloneSystem } from '../hazardData';

interface CycloneTrackLayerProps {
  cyclone: CycloneSystem;
}

/**
 * The storm-track portion of what used to be a standalone CycloneMap with
 * its own MapContainer - just the likely-affected-area circles and position
 * markers, meant to be nested inside HazardMap's single shared map (see that
 * component) so Cyclone is one more toggle on the same map instead of a
 * second one. No connecting track line - each indexed point along the
 * system's path gets its own circle, sized by that point's category and
 * colored by its condition, the way an actual advisory bulletin maps the
 * storm's reach rather than just its center line. Forecast points get a
 * dashed outline and lighter fill to mark them as projected, not observed.
 */
export function CycloneTrackLayer({ cyclone }: CycloneTrackLayerProps) {
  const observed = cyclone.track.filter((p) => p.observed);
  const current = observed[observed.length - 1] ?? cyclone.track[0];
  const currentIndex = cyclone.track.indexOf(current);

  return (
    <>
      {cyclone.track.map((p, i) => {
        const isCurrent = i === currentIndex;
        const color = CLASSIFICATION_COLOR[p.classification];
        return (
          <Circle
            key={i}
            center={[p.lat, p.lng]}
            radius={cycloneImpactRadiusKm(p.classification) * 1000}
            pathOptions={{
              color,
              weight: isCurrent ? 3 : 2,
              opacity: p.observed ? 0.9 : 0.65,
              dashArray: p.observed ? undefined : '10 8',
              fillColor: color,
              fillOpacity: p.observed ? 0.28 : 0.16,
            }}
          >
            <Tooltip>
              <strong>{p.classification}</strong>
              <br />
              {p.windKmph} km/h &bull; {dayjs(p.at).format('DD MMM, HH:mm')}
              <br />
              Likely affected radius: ~{cycloneImpactRadiusKm(p.classification)} km
              <br />
              {p.observed ? 'Observed' : 'Forecast'}
            </Tooltip>
          </Circle>
        );
      })}

      {/* A small, fixed-size dot marks each point's exact center
         (independent of the affected-area circle's radius), so the
         track's actual index/position is still readable even where two
         categories' circles overlap heavily. */}
      {cyclone.track.map((p, i) => {
        const isCurrent = i === currentIndex;
        return (
          <CircleMarker
            key={i}
            center={[p.lat, p.lng]}
            radius={isCurrent ? 8 : 5}
            pathOptions={{
              color: '#ffffff',
              weight: isCurrent ? 3 : 1.5,
              fillColor: CLASSIFICATION_COLOR[p.classification],
              fillOpacity: 1,
            }}
          >
            {isCurrent && (
              <Tooltip permanent direction="top" offset={[0, -10]} className="cyclone-current-label">
                Current position
              </Tooltip>
            )}
          </CircleMarker>
        );
      })}
    </>
  );
}
