import type { WeatherParameter } from './constants';
import type { WeatherCondition } from '@/features/weather/types';

/**
 * Four-band risk classification used across the Live Map legend, the
 * Alerts feed, and the Tower Risk Reports page. The same four bands are
 * labeled differently depending on context (the map calls them
 * "Warning/Alert/Watch/No warning"; risk reports call them
 * "Extreme/High/Moderate/Normal") but represent the same severity scale.
 */
export type RiskLevel = 'none' | 'watch' | 'alert' | 'warning';

export const RISK_LEVELS: RiskLevel[] = ['warning', 'alert', 'watch', 'none'];

export const MAP_RISK_LABEL: Record<RiskLevel, string> = {
  warning: 'Warning',
  alert: 'Alert',
  watch: 'Watch',
  none: 'No warning',
};

export const REPORT_RISK_LABEL: Record<RiskLevel, string> = {
  warning: 'Extreme',
  alert: 'High',
  watch: 'Moderate',
  none: 'Normal',
};

// Same blue -> green -> amber -> red scale as mapLayers.ts's LAYER_COLORS
// (kept in sync manually since this file has no dependency on that one) -
// matches the reference product's district/region choropleth (Scope
// Document for POC, p.4) for any risk map that doesn't pass a specific
// layer's own palette (e.g. FloodMap/RegionRiskMap's default coloring).
export const RISK_COLOR: Record<RiskLevel, string> = {
  warning: '#dc2626',
  alert: '#f59e0b',
  watch: '#22c55e',
  none: '#38bdf8',
};

/** Neutral fill used for map regions (districts) with no monitored sites -
 *  distinct from any risk color so "no data" is never mistaken for "safe". */
export const NO_DATA_COLOR = '#5b6472';

/** Ordinal rank of each risk band, low to high, used to combine risk levels
 *  (e.g. a district's overall risk = the worst risk among its sites). */
export const RISK_RANK: Record<RiskLevel, number> = { none: 0, watch: 1, alert: 2, warning: 3 };

/** The more severe of two risk levels. */
export function worseRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_RANK[a] >= RISK_RANK[b] ? a : b;
}

interface Band {
  min: number;
  level: RiskLevel;
}

// Each list is checked from the highest threshold down; the first band whose
// `min` the value meets or exceeds wins. Tuned to be broadly representative
// (not sourced from any proprietary threshold table).
const BANDS: Record<WeatherParameter, Band[]> = {
  temperature: [
    { min: 45, level: 'warning' },
    { min: 40, level: 'alert' },
    { min: 35, level: 'watch' },
    { min: -Infinity, level: 'none' },
  ],
  rainfall: [
    { min: 40, level: 'warning' },
    { min: 20, level: 'alert' },
    { min: 10, level: 'watch' },
    { min: -Infinity, level: 'none' },
  ],
  windSpeed: [
    { min: 60, level: 'warning' },
    { min: 40, level: 'alert' },
    { min: 30, level: 'watch' },
    { min: -Infinity, level: 'none' },
  ],
  humidity: [
    { min: 95, level: 'warning' },
    { min: 90, level: 'alert' },
    { min: 80, level: 'watch' },
    { min: -Infinity, level: 'none' },
  ],
  // Pressure risk rises as the value *drops*, the opposite direction from
  // every other parameter, so it's handled as a special case in
  // getParameterRisk() below rather than fitting the "min" band shape here.
  pressure: [],
  lightning: [
    { min: 20, level: 'warning' },
    { min: 10, level: 'alert' },
    { min: 1, level: 'watch' },
    { min: -Infinity, level: 'none' },
  ],
  windDirection: [{ min: -Infinity, level: 'none' }],
};

export function getParameterRisk(parameter: WeatherParameter, value: number): RiskLevel {
  if (parameter === 'pressure') {
    if (value < 990) return 'warning';
    if (value < 995) return 'alert';
    if (value < 1000) return 'watch';
    return 'none';
  }
  const bands = BANDS[parameter] ?? [];
  for (const band of bands) {
    if (value >= band.min) return band.level;
  }
  return 'none';
}

/** The numeric threshold a parameter's value has to reach for a given
 *  RiskLevel band, read straight from this file's own BANDS table (or the
 *  pressure special-case) instead of a second, hand-copied set of numbers -
 *  added for the Skymet-based forecast alert feed
 *  (src/pages/alerts/useSkymetForecastAlerts.ts), which needs to show
 *  "predicted X, band starts at Y" without re-stating BANDS' thresholds
 *  anywhere else. Returns null for 'none' (no lower bound to show) or for a
 *  parameter/level pair BANDS has no finite entry for. */
export function getParameterThreshold(parameter: WeatherParameter, level: RiskLevel): number | null {
  if (level === 'none') return null;
  if (parameter === 'pressure') {
    if (level === 'warning') return 990;
    if (level === 'alert') return 995;
    if (level === 'watch') return 1000;
    return null;
  }
  const band = (BANDS[parameter] ?? []).find((b) => b.level === level);
  return band && Number.isFinite(band.min) ? band.min : null;
}

/** Synthetic cloud-cover percentage derived from the observed condition
 *  (the mock weather generator doesn't track cloud % directly). */
export function estimateCloudCoverPercent(condition: WeatherCondition): number {
  const map: Record<WeatherCondition, number> = {
    clear: 8,
    'partly-cloudy': 40,
    cloudy: 75,
    rain: 85,
    thunderstorm: 95,
    fog: 60,
    windy: 30,
  };
  return map[condition];
}

export function getCloudRisk(condition: WeatherCondition): RiskLevel {
  const pct = estimateCloudCoverPercent(condition);
  if (pct >= 90) return 'warning';
  if (pct >= 70) return 'alert';
  if (pct >= 40) return 'watch';
  return 'none';
}

export function getVisibilityRisk(visibilityKm: number): RiskLevel {
  if (visibilityKm < 1) return 'warning';
  if (visibilityKm < 2) return 'alert';
  if (visibilityKm < 4) return 'watch';
  return 'none';
}

/** Snowfall risk. Prefers a real measured/forecast snowfall amount
 *  (`snowfallCm`, from real Indus station data - see
 *  `CurrentObservation.snowfallCm`) when one is available: any real
 *  snowfall means it's already snowing, so the elevation/temperature gate
 *  below doesn't need to double-check that. Falls back to the original
 *  synthetic proxy - elevation + temperature (snow needs both altitude and
 *  cold) - when `snowfallCm` is undefined, which is always true for the
 *  mock/demo generator (it doesn't model snow) and for every current demo
 *  site (all lowland/mid-elevation city towers, so this reads "none" for
 *  all of them). */
export function getSnowfallRisk(elevationMeters: number, temperatureC: number, snowfallCm?: number): RiskLevel {
  if (snowfallCm !== undefined) {
    if (snowfallCm <= 0) return 'none';
    if (snowfallCm >= 5) return 'warning';
    if (snowfallCm >= 2) return 'alert';
    return 'watch';
  }
  if (elevationMeters < 1500 || temperatureC > 4) return 'none';
  if (temperatureC <= -8) return 'warning';
  if (temperatureC <= -2) return 'alert';
  if (temperatureC <= 2) return 'watch';
  return 'none';
}

/** Avalanche risk: proxies the classic "steep, cold, windy high-altitude
 *  slope" combination from snowfall (real when available, else the
 *  elevation/temperature proxy - see `getSnowfallRisk`) + elevation + wind
 *  speed, since slope angle and snowpack depth aren't modeled either way.
 *  Still gated on elevation even with real snowfall data, since a real
 *  elevation reading isn't available from the Indus source either (see the
 *  backend's IndusSiteMapper) - only a coarse Hilly/Plains-derived
 *  estimate, so this stays a proxy rather than a real avalanche model. */
export function getAvalancheRisk(
  elevationMeters: number,
  temperatureC: number,
  windSpeedKmph: number,
  snowfallCm?: number
): RiskLevel {
  const snow = getSnowfallRisk(elevationMeters, temperatureC, snowfallCm);
  if (snow === 'none' || elevationMeters < 2000) return 'none';
  const windBoost = windSpeedKmph > 40 ? 1 : windSpeedKmph > 20 ? 0.5 : 0;
  const score = RISK_RANK[snow] + windBoost;
  if (score >= 3.5) return 'warning';
  if (score >= 2.5) return 'alert';
  if (score >= 1) return 'watch';
  return 'none';
}

/** Synthetic landslide risk: proxies the classic "saturated hill slope"
 *  trigger from elevation (hilly/hill-station terrain, below the snow
 *  line - above that, saturation from rain rather than snowmelt isn't the
 *  driving factor) + rainfall intensity, reusing rainfall's own thresholds
 *  rather than inventing a separate one - not a real geotechnical/slope-
 *  stability model. Unlike snowfall/avalanche, several demo sites (e.g.
 *  Bengaluru ~900m, Bhopal ~525m, Chandigarh ~320m) do sit in this band,
 *  so this can actually light up during a heavy-rainfall day in the demo
 *  data, rather than always reading "none". */
export function getLandslideRisk(elevationMeters: number, rainfallMm: number): RiskLevel {
  if (elevationMeters < 300 || elevationMeters >= 2500) return 'none';
  return getParameterRisk('rainfall', rainfallMm);
}
