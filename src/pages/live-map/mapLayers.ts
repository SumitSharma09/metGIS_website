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

// 'humidity' added 2026-09-23 per explicit request ("add humidity also in
// live map") - relative_humidity_2m is a real column on the user's own
// hourly_weather table and already flows all the way through
// IndusWeatherData -> IndusWeatherMapper -> CurrentObservationDto ->
// CurrentObservation.humidity (confirmed by reading the backend directly),
// so this is purely a new frontend layer on top of an already-real field -
// no backend change needed.
export type MapLayer = 'temperature' | 'rainfall' | 'humidity' | 'wind' | 'cloud' | 'visibility' | 'fog' | 'lightning' | 'snowfall' | 'avalanche';

export const MAP_LAYERS: { value: MapLayer; label: string }[] = [
  { value: 'temperature', label: 'Temperature' },
  { value: 'rainfall', label: 'Rainfall' },
  { value: 'humidity', label: 'Humidity' },
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
 *   <li>{@code humidity} - a green moisture scale, added 2026-09-23 - kept to
 *   one hue (unlike avalanche's multi-hue green/yellow/orange/red danger
 *   scale below) so it reads as "how much moisture," not a hazard level.</li>
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
  humidity: {
    none: '#d1fae5',
    watch: '#34d399',
    alert: '#059669',
    warning: '#065f46',
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
   *  getCloudRisk, getVisibilityRisk) and layerRisk() below, EXCEPT
   *  rainfall/snowfall, whose Live-Map-only display legend deliberately
   *  diverges from severity.ts - see each entry's own comment below.
   *  `avalanche` is the only layer left with no entry here (still
   *  multi-factor - elevation + temperature + wind + snowfall together, not
   *  one reading against one threshold) and falls back to a plain
   *  qualitative legend. */
  rangeLabel: string;
}

export const LAYER_LEGEND: Partial<Record<MapLayer, LayerLegendBand[]>> = {
  temperature: [
    { level: 'warning', rangeLabel: '≥ 45°C' },
    { level: 'alert', rangeLabel: '40 – 44.9°C' },
    { level: 'watch', rangeLabel: '35 – 39.9°C' },
    { level: 'none', rangeLabel: '< 35°C' },
  ],
  // '/hr' dropped from every band 2026-09-24 per explicit request ("in
  // rainfall index remove /hr in the indexing of rainfall") - the numeric
  // thresholds themselves were unchanged then, only the unit text.
  //
  // RECALIBRATED 2026-09-29 per explicit request ("rainfall is hourly-based
  // data is low like 0.3 and 4 like this based on hourly please change all
  // indexing because i need to show visualization changes everyhour if
  // timeline is start"). The OLD thresholds here (10/20/39/40mm) were, per
  // this project's own severity.ts comment, "tuned to be broadly
  // representative, not sourced from any proprietary threshold table" - and
  // in practice, this app's real `rainfallLastHour` readings are ordinary
  // hourly amounts (0.3mm, 4mm, etc.), which all land deep inside the old
  // 0-10mm "none" floor with almost no room to visibly shift shade as the
  // timeline's hourly slider moves - exactly the reported symptom. Replaced
  // with India Meteorological Department's own published hourly
  // rainfall-intensity classes (Light/Moderate/Rather Heavy-Heavy/Very
  // Heavy+), collapsed to this app's 4-band none/watch/alert/warning scale:
  //   none    = Light or no rain   (< 2.5 mm/hr)
  //   watch   = Moderate rain      (2.5 - 7.5 mm/hr)
  //   alert   = Rather Heavy/Heavy (7.6 - 35.5 mm/hr)
  //   warning = Very Heavy or more (>= 35.6 mm/hr)
  // A reading like 4mm now falls squarely in "watch" instead of buried near
  // the bottom of a 10mm-wide "none" band - see LAYER_GRADIENT_STOPS below
  // for the matching continuous-fill breakpoints.
  //
  // SCOPE, explicitly confirmed with the user before this change: this is a
  // LIVE MAP DISPLAY-ONLY recalibration (this file only). The shared,
  // underlying risk classification in severity.ts's `BANDS.rainfall` (used
  // by individual tower markers in the Indus/Towers view, the Alerts feed,
  // and Tower Risk Reports) is DELIBERATELY left at its original 10/20/40mm
  // thresholds - the user chose not to change those. This means, for the
  // same rainfall reading, the district/state choropleth's smooth fill
  // (colorForValue, fed by LAYER_GRADIENT_STOPS below) can now show a
  // meaningfully different shade than what a tower marker's discrete color
  // or an Alerts-feed entry would classify it as - an accepted, explained
  // tradeoff of this narrower scope, not an inconsistency to "fix" later
  // without asking again.
  //
  // RE-RECALIBRATED 2026-09-30 per explicit request ("rainfall index is
  // warning for greater than 35 remove this greater then 15 add this
  // 7.5-14.9 alert and then greater 15 is warning"): tightens the
  // alert/warning boundary from the IMD "Very Heavy" cutoff (35.6mm) down to
  // 15mm - alert now covers 7.5-14.9mm (was 7.6-35.5mm) and warning starts
  // at 15mm (was 35.6mm). The lower none/watch boundary (2.5mm) is
  // untouched - only the top two bands moved. Same "Live Map display only"
  // scope as before - severity.ts's BANDS.rainfall stays at its original
  // 10/20/40mm, unchanged again.
  rainfall: [
    { level: 'warning', rangeLabel: '≥ 15 mm' },
    { level: 'alert', rangeLabel: '7.5 – 14.9 mm' },
    { level: 'watch', rangeLabel: '2.5 – 7.4 mm' },
    { level: 'none', rangeLabel: '< 2.5 mm' },
  ],
  // Matches severity.ts's existing `humidity` BANDS exactly (that table
  // already had a humidity entry, used elsewhere in the app - e.g. Tower
  // Risk Reports - before this layer existed on the Live Map).
  humidity: [
    { level: 'warning', rangeLabel: '≥ 95%' },
    { level: 'alert', rangeLabel: '90 – 94%' },
    { level: 'watch', rangeLabel: '80 – 89%' },
    { level: 'none', rangeLabel: '< 80%' },
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
  // NEW 2026-09-29 per explicit request ("add indexing in snowfall as per
  // imd") - this layer previously had NO legend/gradient entry at all
  // (fell back to a flat, plain-qualitative color via colorForValue's own
  // fallback, same as avalanche still does). Based on the snowfall-intensity
  // classes commonly published in India's hill-station/J&K-HP-Uttarakhand
  // weather bulletins (Light / Moderate / Heavy / Very Heavy), collapsed to
  // this app's 4-band scale the same way rainfall's 6 IMD classes were
  // collapsed above - here there are only 4 real named classes to begin
  // with, so ONE combination (Moderate+Heavy -> alert) was still needed to
  // leave "none" as a genuine, distinct zero-snow band:
  //   none    = No snow             (0 cm)
  //   watch   = Light snow          (0.1 - 5 cm)
  //   alert   = Moderate/Heavy snow (5.1 - 20 cm)
  //   warning = Very Heavy snow     (> 20 cm)
  // Same "Live Map display only" scope as rainfall's recalibration above:
  // severity.ts's `getSnowfallRisk` (used by tower markers in the
  // Indus/Towers view, the Alerts feed, and Tower Risk Reports) keeps its
  // own separate, unrelated 0/2/5cm real-snowfall thresholds (plus its
  // elevation/temperature proxy for sites with no real measurement) -
  // deliberately untouched here, same reasoning as rainfall's own comment.
  //
  // RE-RECALIBRATED 2026-09-30 per explicit request ("same as snowfall
  // 5.1-10 alert and then greater 10 warning"), alongside rainfall's own
  // same-day tightening above: alert/warning boundary moves from 20cm down
  // to 10cm - alert now covers 5.1-10cm (was 5.1-20cm) and warning starts
  // above 10cm (was above 20cm). The lower none/watch boundary (5cm) is
  // untouched. Same "Live Map display only" scope - severity.ts's
  // getSnowfallRisk is unchanged.
  snowfall: [
    { level: 'warning', rangeLabel: '> 10 cm' },
    { level: 'alert', rangeLabel: '5.1 – 10 cm' },
    { level: 'watch', rangeLabel: '0.1 – 5 cm' },
    { level: 'none', rangeLabel: '0 cm' },
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

interface GradientStop {
  value: number;
  level: RiskLevel;
}

// Numeric breakpoints for `colorForValue` below, one list per layer that has
// a single-reading-vs-threshold risk model (mirrors severity.ts's BANDS and
// LAYER_LEGEND's own numeric ranges above - keep all three in sync). Each
// list starts below severity.ts's own "none" floor (e.g. 15°C for
// temperature, well under the 35°C "watch" cutoff) rather than at
// -Infinity, so the "none" band itself has room to shade continuously
// across its own realistic range instead of being one single flat tile.
// This is what actually fixes "the hourly slider doesn't change color" for
// ordinary (non-extreme) weather: real Indian conditions usually never
// leave the "none" band all week, so a flat per-band fill genuinely never
// changed shade even though the underlying reading was - see
// `colorForValue`'s own doc comment for how this list turns that same
// reading into a continuously shifting shade instead.
// visibility/fog are inverted (a LOWER reading is worse), so their stops
// run ascending in value but descending in severity, matching
// getVisibilityRisk's own thresholds exactly. avalanche is the only layer
// left with no entry - still multi-factor (elevation + temperature + wind +
// snowfall together), not one reading against one threshold, so it keeps
// the plain discrete risk color via colorForValue's fallback. snowfall
// GAINED an entry 2026-09-29 (see LAYER_LEGEND.snowfall above for the full
// rationale) - IMPORTANT: its `value` must come from `layerGradientValue()`
// below, NEVER straight from `layerReading('snowfall', ...).value` - see
// that function's own doc comment for why (layerReading substitutes a
// site's ELEVATION in meters as a display stand-in when no real snowfallCm
// exists, which colorForValue would otherwise misread as centimeters of
// snow).
//
// REVIEWED EVERY LAYER 2026-09-29 for the same "doesn't visibly change hour
// to hour" complaint that motivated rainfall's recalibration just above
// (user explicitly asked to check every parameter, only change the ones
// genuinely too coarse for real hourly values - not a blanket rescale).
// Conclusion: rainfall was the one confirmed case, for a specific,
// structural reason none of the others share - `rainfallLastHour` is an
// HOURLY ACCUMULATION that resets every hour and is ordinarily small
// (0-5mm), so its old 0-10mm "none" floor left almost no room to move.
// Every other layer either:
//  - reads a genuinely INSTANTANEOUS quantity that already swings across a
//    meaningful share of its own "none" band over a real day/night cycle
//    (temperature: ~15-35C span vs. a typical ~10-15C daily swing;
//    humidity: 30-80% span vs. a typical ~40-50 point daily swing; wind:
//    0-30 km/h span vs. typical 5-20 km/h ambient speeds) - so these were
//    already producing visible shade changes as the timeline moves, just
//    for a genuinely different reason than rainfall's near-zero-most-of-
//    the-time accumulation problem; or
//  - is correctly flat when nothing is happening, which is accurate
//    weather, not a calibration bug (lightning: near-always 0 strikes/hr on
//    a non-stormy day; cloud: a synthetic estimate off a small fixed set of
//    condition values - clear/partly-cloudy/cloudy/etc. - so it steps
//    between a handful of discrete shades by design, not a threshold-tuning
//    issue; visibility/fog: reading "none" (clear/good visibility) most of
//    the time on an ordinary day is the correct, expected picture).
// None of these were touched - only rainfall's stops changed, immediately
// below.
const LAYER_GRADIENT_STOPS: Partial<Record<MapLayer, GradientStop[]>> = {
  temperature: [
    { value: 15, level: 'none' },
    { value: 35, level: 'watch' },
    { value: 40, level: 'alert' },
    { value: 45, level: 'warning' },
  ],
  // Matches LAYER_LEGEND.rainfall's new IMD-hourly-class boundaries above -
  // see that entry's own comment for the full rationale and the explicit
  // "Live Map display only" scope decision (severity.ts's BANDS.rainfall,
  // used by tower markers/Alerts/Tower Risk Reports, is unchanged).
  // RE-RECALIBRATED 2026-09-30 (see LAYER_LEGEND.rainfall's matching comment
  // above): warning stop moved from 35.5 down to 15, tightening the
  // alert->warning blend to the new 7.5-15mm span instead of 7.5-35.5mm.
  // Four naturally distinct boundaries (0/2.5/7.5/15) still exist here, same
  // as before, so no artificial ceiling stop is needed (contrast snowfall's
  // own comment just below, which does need one).
  rainfall: [
    { value: 0, level: 'none' },
    { value: 2.5, level: 'watch' },
    { value: 7.5, level: 'alert' },
    { value: 15, level: 'warning' },
  ],
  humidity: [
    { value: 30, level: 'none' },
    { value: 80, level: 'watch' },
    { value: 90, level: 'alert' },
    { value: 95, level: 'warning' },
  ],
  wind: [
    { value: 0, level: 'none' },
    { value: 30, level: 'watch' },
    { value: 40, level: 'alert' },
    { value: 60, level: 'warning' },
  ],
  cloud: [
    { value: 0, level: 'none' },
    { value: 40, level: 'watch' },
    { value: 70, level: 'alert' },
    { value: 90, level: 'warning' },
  ],
  visibility: [
    { value: 0, level: 'warning' },
    { value: 1, level: 'alert' },
    { value: 2, level: 'watch' },
    { value: 4, level: 'none' },
  ],
  fog: [
    { value: 0, level: 'warning' },
    { value: 1, level: 'alert' },
    { value: 2, level: 'watch' },
    { value: 4, level: 'none' },
  ],
  lightning: [
    { value: 0, level: 'none' },
    { value: 1, level: 'watch' },
    { value: 10, level: 'alert' },
    { value: 20, level: 'warning' },
  ],
  // Matches LAYER_LEGEND.snowfall's new IMD-hourly-bulletin-class boundaries
  // above - see that entry's own comment for the full rationale.
  // RE-RECALIBRATED 2026-09-30: alert/warning boundary moved from 20cm to
  // 10cm. Still only 3 naturally distinct thresholds here (0/5/10, "warning"
  // itself has no upper bound), so this still needs a 4th, artificial
  // ceiling stop for where the gradient finishes saturating to pure warning
  // color - kept at the SAME "double the warning boundary" rule the
  // previous 40 (= 2 x the old 20cm boundary) already used, just re-applied
  // to the new boundary: 20 (= 2 x 10).
  snowfall: [
    { value: 0, level: 'none' },
    { value: 5, level: 'watch' },
    { value: 10, level: 'alert' },
    { value: 20, level: 'warning' },
  ],
};

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const value = parseInt(clean, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0'))
      .join('')
  );
}

/** Blends two hex colors, `t` in [0, 1] (0 = colorA, 1 = colorB). */
function interpolateColor(colorA: string, colorB: string, t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  const [r1, g1, b1] = hexToRgb(colorA);
  const [r2, g2, b2] = hexToRgb(colorB);
  return rgbToHex(r1 + (r2 - r1) * clamped, g1 + (g2 - g1) * clamped, b1 + (b2 - b1) * clamped);
}

/**
 * Continuous fill color for a layer's numeric reading, in place of the flat
 * per-band `colors[risk]` alone. Interpolates between the SAME four
 * `LAYER_COLORS` stops the legend already uses (so the legend and every
 * fill always agree at the boundaries), positioned at that layer's own
 * `LAYER_GRADIENT_STOPS` breakpoints - so a reading of, say, 32°C (still
 * safely "none", between the 15°C and 35°C stops) renders partway between
 * the "none" and "watch" colors rather than pinned to flat "none", and
 * visibly shifts shade hour to hour on the Live Map's timeline scrubber
 * even during an entirely ordinary week. `value` should be the same
 * reading `layerRisk`/`layerReading` already use for this layer (or a
 * `DistrictRiskInfo.avgValue` aggregate of it). Falls back to the plain
 * discrete `colors[fallbackRisk]` when the layer has no gradient table
 * (snowfall/avalanche) or `value` isn't available yet.
 */
export function colorForValue(
  layer: MapLayer,
  colors: Record<RiskLevel, string>,
  value: number | undefined,
  fallbackRisk: RiskLevel
): string {
  const stops = LAYER_GRADIENT_STOPS[layer];
  if (!stops || value === undefined || Number.isNaN(value)) {
    return colors[fallbackRisk];
  }
  if (value <= stops[0].value) return colors[stops[0].level];
  for (let i = 1; i < stops.length; i++) {
    if (value <= stops[i].value) {
      const prev = stops[i - 1];
      const curr = stops[i];
      const t = (value - prev.value) / (curr.value - prev.value);
      return interpolateColor(colors[prev.level], colors[curr.level], t);
    }
  }
  return colors[stops[stops.length - 1].level];
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
      return { value: obs.rainfallLastHour, unit: 'mm', label: 'Rainfall (last hr)' };
    case 'humidity':
      return { value: obs.humidity, unit: '%', label: 'Humidity' };
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

/**
 * The numeric reading actually safe to feed a continuous color GRADIENT
 * (colorForValue, via buildDistrictRiskIndex's/buildStateRiskIndex's
 * `valueFn`) for the currently active layer - distinct from
 * `layerReading()`'s own `value` above, which for snowfall/avalanche
 * substitutes a site's ELEVATION (in meters) as a display stand-in whenever
 * no real measured `snowfallCm` exists (see layerReading's own
 * snowfall/avalanche cases) - a reasonable thing to show in a tooltip
 * ("Snowfall risk (by elevation)"), but one that must NEVER be interpolated
 * as if it were centimeters of snow: a 2000m-elevation hill station would
 * otherwise render as "2000cm of snow" - permanently pinned to the single
 * worst color on the scale - regardless of its real, current weather.
 * Returns `undefined` whenever there's no real measured amount to grade a
 * site by, so buildDistrictRiskIndex/buildStateRiskIndex correctly average
 * and color-grade only the sites that actually have one (their own
 * `valueCount`-based average, not diluted by sites with no real reading -
 * see districtRisk.ts's own comment on that), falling back to the flat
 * discrete risk color (colorForValue's own fallback) for a district/state
 * with no real reading to grade at all, rather than silently misreading a
 * substituted proxy value as a real measurement.
 * <p>
 * Added 2026-09-29 alongside snowfall's new LAYER_GRADIENT_STOPS entry
 * below, which is what first made this distinction load-bearing -
 * previously, `layerReading(...).value`'s substituted elevation was always
 * harmless, because every layer with no LAYER_GRADIENT_STOPS entry
 * (snowfall/avalanche both, until now) fell straight back to the flat
 * discrete color via colorForValue's own `!stops` check, so nothing ever
 * actually read that substituted value as a number to grade by.
 */
export function layerGradientValue(
  layer: MapLayer,
  obs: CurrentObservation,
  site?: Pick<Site, 'elevationMeters'>
): number | undefined {
  if (layer === 'snowfall') return obs.snowfallCm;
  if (layer === 'avalanche') return undefined; // still no LAYER_GRADIENT_STOPS entry - always the flat discrete risk color
  return layerReading(layer, obs, site).value;
}

/** Unit + short label for a layer's AVERAGED reading (no single observation
 *  involved, unlike `layerReading` above) - used by the Live Map's default
 *  state choropleth to show an actual figure in the tooltip ("28.4°C"),
 *  not just a risk color, matching the request to surface real temperature
 *  (or whichever parameter is active) data per state before the user drills
 *  into one. Kept as a separate, simpler function from `layerReading`
 *  because an aggregate average has no single `CurrentObservation`/site to
 *  read a unit off of.
 *
 *  Labels deliberately drop the "Avg " prefix (removed 2026-09-22 per
 *  explicit request - "remove avg in every parameter in mouse over") even
 *  though the underlying figure genuinely is a cross-site average (see
 *  `DistrictRiskInfo.avgValue`'s own doc comment in districtRisk.ts) - the
 *  averaging itself is unchanged, only the word is gone from the tooltip. */
export function layerUnitLabel(layer: MapLayer): { unit: string; label: string } {
  switch (layer) {
    case 'temperature':
      return { unit: '°C', label: 'Temperature' };
    case 'rainfall':
      return { unit: 'mm', label: 'Rainfall' };
    case 'humidity':
      return { unit: '%', label: 'Humidity' };
    case 'wind':
      return { unit: 'km/h', label: 'Wind speed' };
    case 'cloud':
      return { unit: '%', label: 'Cloud cover (est.)' };
    case 'visibility':
      return { unit: 'km', label: 'Visibility' };
    case 'fog':
      return { unit: 'km', label: 'Visibility' };
    case 'lightning':
      return { unit: '/hr', label: 'Lightning (est.)' };
    case 'snowfall':
      return { unit: 'cm', label: 'Snowfall' };
    case 'avalanche':
      return { unit: 'm', label: 'Elevation' };
    default:
      return { unit: '', label: '' };
  }
}

const COMPASS_16_POINTS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

/** Converts a wind-direction reading in degrees (0-359, meteorological
 *  convention - the direction the wind is blowing FROM, 0/360 = North) to
 *  its nearest 16-point compass abbreviation (e.g. 135 -> "SE"). Added
 *  2026-09-22 so the wind-speed tooltip can show a direction alongside the
 *  speed instead of speed alone - `CurrentObservation.windDirection` is
 *  already a real per-site degrees reading, this just makes it readable.
 *  This is the inverse of `NetworkWeatherPanel.tsx`'s own
 *  `windDirectionDegrees()`, which goes the other way (Skymet's own short
 *  compass string -> degrees, for rotating that panel's arrow icon) - kept
 *  as two separate small functions since they serve different data sources
 *  and callers, not worth merging into one shared util for two call sites. */
export function degreesToCompass16(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return COMPASS_16_POINTS[index];
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
    case 'humidity':
      return getParameterRisk('humidity', obs.humidity);
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
