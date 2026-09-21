import type { Site } from '@/features/sites/types';
import type { CurrentObservation } from '@/features/weather/types';

export interface WindSample {
  lat: number;
  lon: number;
  /** East/north vector components, both in the observation's own km/h
   *  units - `windDirection` is treated as the compass bearing the wind
   *  blows *toward* (0=N, 90=E, ...), matching the convention the existing
   *  per-site arrow icon already used (`rotate(windDirection deg)` on an
   *  up-pointing glyph), so this stays visually consistent with anything
   *  else in the app that reads `windDirection` directly. */
  u: number;
  v: number;
}

export function buildWindSamples(sites: Site[], observations: Record<string, CurrentObservation>): WindSample[] {
  const samples: WindSample[] = [];
  sites.forEach((site) => {
    const obs = observations[site.id];
    if (!obs) return;
    const dirRad = (obs.windDirection * Math.PI) / 180;
    samples.push({
      lat: site.latitude,
      lon: site.longitude,
      u: obs.windSpeed * Math.sin(dirRad),
      v: obs.windSpeed * Math.cos(dirRad),
    });
  });
  return samples;
}

/**
 * Inverse-distance-weighted wind vector at an arbitrary point, from the
 * sparse set of monitored-site observations. This is a visual
 * approximation, not a real gridded weather-model field - the flow gets
 * less trustworthy the farther a point sits from any monitored site, since
 * it's inferring rather than measuring. Distance is an approximate
 * lat/lon-degree distance (longitude scaled by cos(latitude)), which is
 * plenty accurate for weighting purposes at this scale.
 */
export function interpolateWind(lat: number, lon: number, samples: WindSample[]): { u: number; v: number } {
  if (samples.length === 0) return { u: 0, v: 0 };
  const latRad = (lat * Math.PI) / 180;
  const lonScale = Math.cos(latRad);

  let weightSum = 0;
  let u = 0;
  let v = 0;
  for (const sample of samples) {
    const dLat = lat - sample.lat;
    const dLon = (lon - sample.lon) * lonScale;
    const distSq = dLat * dLat + dLon * dLon;
    if (distSq < 1e-8) return { u: sample.u, v: sample.v }; // essentially on top of a site
    const weight = 1 / distSq; // p=2 inverse-distance weighting
    weightSum += weight;
    u += weight * sample.u;
    v += weight * sample.v;
  }
  return { u: u / weightSum, v: v / weightSum };
}

/** Speed (in the same km/h units as the source observations) -> color. A
 *  single dark-blue family throughout (deepening with speed) rather than a
 *  multi-hue scale, per the requested "wind flow color is dark blue" look. */
const SPEED_COLOR_STOPS: { speed: number; rgb: [number, number, number] }[] = [
  { speed: 0, rgb: [59, 130, 246] }, // blue-500 - calm
  { speed: 20, rgb: [37, 99, 235] }, // blue-600
  { speed: 40, rgb: [29, 78, 216] }, // blue-700
  { speed: 60, rgb: [23, 37, 84] }, // dark navy - gust
];

export function windSpeedColor(speedKmh: number, alpha: number): string {
  const stops = SPEED_COLOR_STOPS;
  if (speedKmh <= stops[0].speed) return rgbaOf(stops[0].rgb, alpha);
  for (let i = 1; i < stops.length; i += 1) {
    if (speedKmh <= stops[i].speed) {
      const prev = stops[i - 1];
      const t = (speedKmh - prev.speed) / (stops[i].speed - prev.speed);
      return rgbaOf(lerpRgb(prev.rgb, stops[i].rgb, t), alpha);
    }
  }
  return rgbaOf(stops[stops.length - 1].rgb, alpha);
}

/** CSS gradient stops (0% = calm, 100% = gust) for the legend's vertical
 *  gradient bar, sharing the exact same colors particles are drawn with. */
export const WIND_GRADIENT_CSS = `linear-gradient(to top, ${SPEED_COLOR_STOPS.map(
  (s, i) => `rgb(${s.rgb.join(',')}) ${(i / (SPEED_COLOR_STOPS.length - 1)) * 100}%`
).join(', ')})`;

function lerpRgb(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgbaOf(rgb: [number, number, number], alpha: number): string {
  return `rgba(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])}, ${alpha})`;
}
