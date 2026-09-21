import type { CurrentObservation } from '@/features/weather/types';
import type { Site } from '@/features/sites/types';
import {
  getParameterRisk,
  getCloudRisk,
  estimateCloudCoverPercent,
  getVisibilityRisk,
  getSnowfallRisk,
  getAvalancheRisk,
  type RiskLevel,
} from '@/utils/severity';

export type MapLayer = 'temperature' | 'rainfall' | 'wind' | 'cloud' | 'visibility' | 'fog' | 'lightning' | 'snowfall' | 'avalanche';

export const MAP_LAYERS: { value: MapLayer; label: string }[] = [
  { value: 'temperature', label: 'Temperature' },
  { value: 'rainfall', label: 'Rainfall' },
  { value: 'cloud', label: 'Cloud' },
  { value: 'visibility', label: 'Visibility' },
  { value: 'fog', label: 'Fog' },
  { value: 'wind', label: 'Wind' },
  { value: 'lightning', label: 'Lightning' },
  { value: 'snowfall', label: 'Snowfall' },
  { value: 'avalanche', label: 'Avalanche' },
];

/**
 * Each parameter gets its OWN four-stop severity ramp (still none -> watch
 * -> alert -> warning, low to high) in a hue family meteorologists actually
 * use for that phenomenon, so a glance at the map's color alone tells you
 * *which* parameter is active, not just how severe it is - e.g. an amber/
 * red temperature choropleth reads completely differently from a blue
 * rainfall one, even at the same zoom level with no legend in view.
 * <p>
 * This replaces an earlier design (a single shared blue/green/amber/red
 * scale reused for every layer, matching an early reference mockup) that
 * was reverted on explicit request for per-parameter, "professional
 * meteorological" coloring instead. Sources for each family:
 * <ul>
 *   <li>{@code temperature} - IMD's own heat-wave warning colors
 *   (yellow/orange/red), the standard India uses for heat alerts.</li>
 *   <li>{@code rainfall} - the blue precipitation-intensity scale common to
 *   radar/rainfall accumulation maps (IMD, NOAA).</li>
 *   <li>{@code wind} - teal, distinct from both temperature and rainfall so
 *   a wind-speed choropleth is never mistaken for either at a glance.</li>
 *   <li>{@code cloud} - grayscale, the conventional cloud-cover palette
 *   (white/light-gray = clear sky, near-black = fully overcast).</li>
 *   <li>{@code visibility} - violet/purple, matching low-visibility/haze
 *   shading on aviation and highway-visibility charts.</li>
 *   <li>{@code fog} - a cooler cyan/mist family, close to but distinguishable
 *   from visibility's violet (fog is visibility-driven but its own layer).</li>
 *   <li>{@code lightning} - magenta/pink, the family used for lightning-
 *   strike-density overlays on radar products.</li>
 *   <li>{@code snowfall} - icy indigo/blue-violet, distinct from rainfall's
 *   plain blue so snow vs. rain read as different phenomena.</li>
 *   <li>{@code avalanche} - green/yellow/orange/red, the exact 4-color
 *   subset of the real-world North American/European avalanche danger
 *   scale (which has a 5th, black "extreme" band this app's 4-level model
 *   doesn't have a slot for).</li>
 * </ul>
 */
export const LAYER_COLORS: Record<MapLayer, Record<RiskLevel, string>> = {
  temperature: {
    none: '#fde047',
    watch: '#fb923c',
    alert: '#ea580c',
    warning: '#b91c1c',
  },
  rainfall: {
    none: '#bfdbfe',
    watch: '#60a5fa',
    alert: '#2563eb',
    warning: '#1e3a8a',
  },
  wind: {
    none: '#99f6e4',
    watch: '#2dd4bf',
    alert: '#0d9488',
    warning: '#134e4a',
  },
  cloud: {
    none: '#e2e8f0',
    watch: '#94a3b8',
    alert: '#475569',
    warning: '#1e293b',
  },
  visibility: {
    none: '#ddd6fe',
    watch: '#a78bfa',
    alert: '#7c3aed',
    warning: '#4c1d95',
  },
  fog: {
    none: '#cffafe',
    watch: '#67e8f9',
    alert: '#0e7490',
    warning: '#164e63',
  },
  lightning: {
    none: '#fbcfe8',
    watch: '#f472b6',
    alert: '#db2777',
    warning: '#831843',
  },
  snowfall: {
    none: '#e0e7ff',
    watch: '#a5b4fc',
    alert: '#6366f1',
    warning: '#3730a3',
  },
  avalanche: {
    none: '#4ade80',
    watch: '#eab308',
    alert: '#f97316',
    warning: '#dc2626',
  },
};

export interface LayerLegendBand {
  level: RiskLevel;
  /** Human-readable range in the layer's own unit, for the map legend -
   *  keep these in sync with the actual thresholds in severity.ts (BANDS,
   *  getCloudRisk, getVisibilityRisk) and layerRisk() below. Layers with no
   *  entry here (snowfall/avalanche - multi-factor, not a single reading
   *  vs. a threshold) fall back to a plain qualitative legend. */
  rangeLabel: string;
}

export const LAYER_LEGEND: Partial<Record<MapLayer, LayerLegendBand[]>> = {
  temperature: [
    { level: 'warning', rangeLabel: '≥ 45°C' },
    { level: 'alert', rangeLabel: '40 – 44.9°C' },
    { level: 'watch', rangeLabel: '35 – 39.9°C' },
    { level: 'none', rangeLabel: '< 35°C' },
  ],
  rainfall: [
    { level: 'warning', rangeLabel: '≥ 40 mm/hr' },
    { level: 'alert', rangeLabel: '20 – 39 mm/hr' },
    { level: 'watch', rangeLabel: '10 – 19 mm/hr' },
    { level: 'none', rangeLabel: '< 10 mm/hr' },
  ],
  wind: [
    { level: 'warning', rangeLabel: '≥ 60 km/h' },
    { level: 'alert', rangeLabel: '40 – 59 km/h' },
    { level: 'watch', rangeLabel: '30 – 39 km/h' },
    { level: 'none', rangeLabel: '< 30 km/h' },
  ],
  cloud: [
    { level: 'warning', rangeLabel: '≥ 90% cover' },
    { level: 'alert', rangeLabel: '70 – 89% cover' },
    { level: 'watch', rangeLabel: '40 – 69% cover' },
    { level: 'none', rangeLabel: '< 40% cover' },
  ],
  visibility: [
    { level: 'warning', rangeLabel: '< 1 km' },
    { level: 'alert', rangeLabel: '1 – 1.9 km' },
    { level: 'watch', rangeLabel: '2 – 3.9 km' },
    { level: 'none', rangeLabel: '≥ 4 km' },
  ],
  fog: [
    { level: 'warning', rangeLabel: '< 1 km' },
    { level: 'alert', rangeLabel: '1 – 1.9 km' },
    { level: 'watch', rangeLabel: '2 – 3.9 km' },
    { level: 'none', rangeLabel: '≥ 4 km' },
  ],
  lightning: [
    { level: 'warning', rangeLabel: '≥ 20 /hr' },
    { level: 'alert', rangeLabel: '10 – 19 /hr' },
    { level: 'watch', rangeLabel: '1 – 9 /hr' },
    { level: 'none', rangeLabel: '0 /hr' },
  ],
};

/** A single continuous vertical gradient spanning a layer's whole color
 *  family, most severe ("warning") at the top down to least ("none") at
 *  the bottom - matches `RISK_LEVELS`' own top-to-bottom order, and the
 *  same visual language `WIND_GRADIENT_CSS` (windField.ts) already uses
 *  for the wind-flow legend, so every legend swatch in the app reads the
 *  same way regardless of which parameter it's for. */
export function layerGradientCss(colors: Record<RiskLevel, string>): string {
  return `linear-gradient(to top, ${colors.none} 0%, ${colors.watch} 40%, ${colors.alert} 70%, ${colors.warning} 100%)`;
}

/** Reading + unit shown on a marker/popup for the currently active layer.
 *  `site` is only needed for the elevation-dependent hazards (snowfall/
 *  avalanche) - every other layer ignores it. */
export function layerReading(
  layer: MapLayer,
  obs: CurrentObservation,
  site?: Pick<Site, 'elevationMeters'>
): { value: number; unit: string; label: string } {
  switch (layer) {
    case 'temperature':
      return { value: obs.temperature, unit: '°C', label: 'Temperature' };
    case 'rainfall':
      return { value: obs.rainfallLastHour, unit: 'mm/hr', label: 'Rainfall (last hr)' };
    case 'wind':
      return { value: obs.windSpeed, unit: 'km/h', label: 'Wind speed' };
    case 'cloud':
      // Matches the value getCloudRisk() actually colors by (see layerRisk
      // below) - showing humidity here instead would silently disagree
      // with the marker/legend color for the same reading.
      return { value: estimateCloudCoverPercent(obs.condition), unit: '%', label: 'Cloud cover (est.)' };
    case 'visibility':
      return { value: obs.visibilityKm, unit: 'km', label: 'Visibility' };
    case 'fog':
      return { value: obs.visibilityKm, unit: 'km', label: 'Visibility (fog)' };
    case 'lightning':
      return { value: obs.lightningStrikesLastHour, unit: '/hr', label: 'Lightning strikes' };
    case 'snowfall':
      return obs.snowfallCm !== undefined
        ? { value: obs.snowfallCm, unit: 'cm', label: 'Snowfall' }
        : { value: site?.elevationMeters ?? 0, unit: 'm elev.', label: 'Snowfall risk (by elevation)' };
    case 'avalanche':
      return { value: site?.elevationMeters ?? 0, unit: 'm elev.', label: 'Avalanche risk (by elevation)' };
    default:
      return { value: 0, unit: '', label: '' };
  }
}

/** Unit + short label for a layer's AVERAGED reading (no single observation
 *  involved, unlike `layerReading` above) - used by the Live Map's default
 *  state choropleth to show an actual figure in the tooltip ("28.4°C avg"),
 *  not just a risk color, matching the request to surface real temperature
 *  (or whichever parameter is active) data per state before the user drills
 *  into one. Kept as a separate, simpler function from `layerReading`
 *  because an aggregate average has no single `CurrentObservation`/site to
 *  read a unit off of. */
export function layerUnitLabel(layer: MapLayer): { unit: string; label: string } {
  switch (layer) {
    case 'temperature':
      return { unit: '°C', label: 'Avg temperature' };
    case 'rainfall':
      return { unit: 'mm/hr', label: 'Avg rainfall' };
    case 'wind':
      return { unit: 'km/h', label: 'Avg wind speed' };
    case 'cloud':
      return { unit: '%', label: 'Avg cloud cover (est.)' };
    case 'visibility':
      return { unit: 'km', label: 'Avg visibility' };
    case 'fog':
      return { unit: 'km', label: 'Avg visibility' };
    case 'lightning':
      return { unit: '/hr', label: 'Avg lightning (est.)' };
    case 'snowfall':
      return { unit: 'cm', label: 'Avg snowfall' };
    case 'avalanche':
      return { unit: 'm', label: 'Avg elevation' };
    default:
      return { unit: '', label: '' };
  }
}

/** Risk classification for a site under the currently active layer -
 *  this drives marker color and the legend, using the same thresholds
 *  shared with the Alerts feed and Tower Risk Reports. */
export function layerRisk(layer: MapLayer, obs: CurrentObservation, site?: Pick<Site, 'elevationMeters'>): RiskLevel {
  switch (layer) {
    case 'temperature':
      return getParameterRisk('temperature', obs.temperature);
    case 'rainfall':
      return getParameterRisk('rainfall', obs.rainfallLastHour);
    case 'wind':
      return getParameterRisk('windSpeed', obs.windSpeed);
    case 'cloud':
      return getCloudRisk(obs.condition);
    case 'visibility':
      return getVisibilityRisk(obs.visibilityKm);
    case 'fog':
      return obs.condition === 'fog' ? getVisibilityRisk(obs.visibilityKm) : 'none';
    case 'lightning':
      return getParameterRisk('lightning', obs.lightningStrikesLastHour);
    case 'snowfall':
      return site ? getSnowfallRisk(site.elevationMeters, obs.temperature, obs.snowfallCm) : 'none';
    case 'avalanche':
      return site ? getAvalancheRisk(site.elevationMeters, obs.temperature, obs.windSpeed, obs.snowfallCm) : 'none';
    default:
      return 'none';
  }
}
