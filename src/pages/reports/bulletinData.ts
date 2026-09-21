import dayjs from 'dayjs';
import {
  getParameterRisk,
  getSnowfallRisk,
  getAvalancheRisk,
  getLandslideRisk,
  worseRisk,
  RISK_RANK,
  type RiskLevel,
} from '@/utils/severity';
import { getFloodRisk, STATE_REGION, type CycloneSystem } from '@/pages/hazards/hazardData';
import type { Site } from '@/features/sites/types';
import type { CurrentObservation } from '@/features/weather/types';
import type { ForecastDaySnapshot } from './useSevenDayObservations';
import type { DailyForecastSnapshot } from './useSevenDayForecastTotals';

/**
 * Data prep shared by the Reports page's two "Daily Weather Bulletin"
 * views (DailyNationalBulletin.tsx - PAN-India, grouped by region; and
 * DailyCircleBulletin.tsx - one circle, grouped by district), matching the
 * "Daily National Bulletin (Planned)" / "Daily Circle level bulletin
 * (Planned)" samples in the SOW document. Both bulletins share the same
 * severity-rows x day-columns matrix shape, just grouped differently, so
 * the matrix-building logic lives here once.
 *
 * The bulletins only ever show the top three bands (Very Heavy/Extreme,
 * Heavy/High, Moderate) - a "none/Normal" row would just be an always-huge
 * list of everywhere-that's-fine, which isn't what either sample shows.
 */
export type BulletinSeverity = Extract<RiskLevel, 'warning' | 'alert' | 'watch'>;
export const BULLETIN_SEVERITIES: BulletinSeverity[] = ['warning', 'alert', 'watch'];

/** Rain/Wind rows use the SOW sample's own "Very Heavy/Heavy/Moderate"
 *  wording (distinct from REPORT_RISK_LABEL's "Extreme/High/Moderate",
 *  which the Hazard table below uses instead - matching the SOW images'
 *  own two different label sets for the same underlying 3 bands). */
export const RAIN_WIND_SEVERITY_LABEL: Record<BulletinSeverity, string> = {
  warning: 'Very Heavy',
  alert: 'Heavy',
  watch: 'Moderate',
};
export const HAZARD_SEVERITY_LABEL: Record<BulletinSeverity, string> = {
  warning: 'Extreme',
  alert: 'High',
  watch: 'Moderate',
};

export const RAIN_LEGEND: Record<BulletinSeverity, string> = {
  warning: '> 150 mm',
  alert: '65 ~ 150 mm',
  watch: '20 ~ 65 mm',
};
export const WIND_LEGEND: Record<BulletinSeverity, string> = {
  warning: '> 100 kmph',
  alert: '60 ~ 100 kmph',
  watch: '40 ~ 60 kmph',
};
// Matches severity.ts's own `temperature` BANDS thresholds exactly, same as
// RAIN_LEGEND/WIND_LEGEND already do for their parameters.
export const TEMPERATURE_LEGEND: Record<BulletinSeverity, string> = {
  warning: '> 45°C',
  alert: '40 ~ 45°C',
  watch: '35 ~ 40°C',
};
// The SOW's own Hazard legend gives numbers for every peril (flood depth in
// metres, snowfall in cm, landslide/avalanche as probabilities) - this app
// doesn't model those quantities (getFloodRisk is rainfall reused, and
// snowfall/avalanche/landslide are elevation-gated multi-factor scores, not
// a single measured value), so copying the SOW's numbers here would show a
// legend that doesn't match what's actually driving the colors. Instead,
// each row below states the real threshold this app computes from when one
// exists (Cyclone kmph, Flooding mm/hr, Lightning strikes/hr all have a
// genuine single-number threshold), and says "multi-factor" for the three
// that don't - keeping this legend honest rather than copying invented units.
export const HAZARD_LEGEND: { key: string; label: string; bands: Record<BulletinSeverity, string> }[] = [
  { key: 'cyclone', label: 'Cyclone (kmph)', bands: { warning: '>= 165', alert: '117 - 165', watch: '87 - 117' } },
  { key: 'lightning', label: 'Lightning (strikes/hr)', bands: { warning: '>= 20', alert: '10 - 19', watch: '1 - 9' } },
  { key: 'flooding', label: 'Flooding (from rainfall)', bands: { warning: '>= 40 mm/hr', alert: '20 - 39 mm/hr', watch: '10 - 19 mm/hr' } },
  {
    key: 'landslide',
    label: 'Landslide',
    bands: { warning: 'Multi-factor', alert: 'Multi-factor', watch: 'Multi-factor' },
  },
  {
    key: 'avalanche',
    label: 'Avalanche',
    bands: { warning: 'Multi-factor', alert: 'Multi-factor', watch: 'Multi-factor' },
  },
  {
    key: 'snowfall',
    label: 'Snowfall',
    bands: { warning: 'Multi-factor', alert: 'Multi-factor', watch: 'Multi-factor' },
  },
];

/** Which of the app's 6 states/regions each state belongs to, for the
 *  Daily National Bulletin's region-grouped rows - falls back to a
 *  visible "Other" bucket (rather than silently dropping the state)
 *  if a state is ever added to the mock data without updating
 *  hazardData.ts's STATE_REGION map. */
export function regionOf(state: string): string {
  return STATE_REGION[state] ?? 'Other';
}

/**
 * "District (State)" display label for the National Bulletin, so a cell
 * names the exact district instead of just the whole state it's in (e.g.
 * "Patna (Bihar & Jharkhand)" rather than just "Bihar & Jharkhand").
 * Parenthesized rather than a second comma - cells already join multiple
 * entries with ", ", and "Patna, Bihar, Mathura, Uttar Pradesh" would be
 * impossible to split back into two places.
 */
export function districtStateLabel(site: Site): string {
  return `${site.district} (${site.state})`;
}

/**
 * Recovers the plain state name behind a districtStateLabel, so the
 * National Bulletin can still decide which region row a district-level
 * entry belongs under (regionOf needs a bare state name, not the combined
 * label). Built once from the current site list; a name not found in the
 * map (shouldn't normally happen) simply won't match any real region and
 * lands under "Other" rather than throwing.
 */
export function buildStateLookup(sites: Site[]): Map<string, string> {
  const map = new Map<string, string>();
  sites.forEach((s) => map.set(districtStateLabel(s), s.state));
  return map;
}

export const REGION_ORDER = ['North', 'East', 'West', 'South', 'Central', 'Northeast', 'Other'];

/** One matrix cell per (severity, day): the sorted, deduped group names
 *  (regions -> state names; a circle -> district names) whose WORST
 *  reading that day falls in that severity band. A group never appears in
 *  more than one severity row for the same day - it's placed at its worst
 *  band only, the same "worst across the group" rule the rest of this
 *  app's choropleths/advisories already use. */
export type SeverityMatrix = Record<BulletinSeverity, string[][]>;

export function buildParameterMatrix(
  sites: Site[],
  days: ForecastDaySnapshot[],
  parameter: 'rainfall' | 'windSpeed',
  groupBy: (site: Site) => string | null
): SeverityMatrix {
  const siteById = new Map(sites.map((s) => [s.id, s]));
  const result: SeverityMatrix = { warning: [], alert: [], watch: [] };

  days.forEach((day) => {
    const worstByGroup = new Map<string, RiskLevel>();
    day.observations.forEach((obs) => {
      const site = siteById.get(obs.siteId);
      if (!site) return;
      const group = groupBy(site);
      if (!group) return;
      const value = parameter === 'rainfall' ? obs.rainfallLastHour : obs.windSpeed;
      const risk = getParameterRisk(parameter, value);
      worstByGroup.set(group, worseRisk(worstByGroup.get(group) ?? 'none', risk));
    });

    BULLETIN_SEVERITIES.forEach((sev) => {
      const names = Array.from(worstByGroup.entries())
        .filter(([, risk]) => risk === sev)
        .map(([name]) => name)
        .sort();
      result[sev].push(names);
    });
  });

  return result;
}

/**
 * Same shape and worst-across-the-group logic as buildParameterMatrix
 * above, but sourced from real DAILY-AGGREGATED forecast values instead of
 * a single noon snapshot: `rainfall` here is a calendar day's rainfall
 * SUM and `temperature` is that day's MAX (see the backend's
 * IndusWeatherMapper.toForecastDay, exposed in batch via
 * WeatherService.forecastForBatch / useSevenDayForecastTotals). This is
 * what the Rain Fall Prediction and (new) Temperature Prediction rows use;
 * Wind stays on buildParameterMatrix/useSevenDayObservations since a gust
 * reading doesn't have an equally obvious "daily" reduction the way a
 * rainfall total or a daily high does.
 */
export function buildForecastParameterMatrix(
  sites: Site[],
  days: DailyForecastSnapshot[],
  parameter: 'rainfall' | 'temperature',
  groupBy: (site: Site) => string | null
): SeverityMatrix {
  const result: SeverityMatrix = { warning: [], alert: [], watch: [] };

  days.forEach((day) => {
    const worstByGroup = new Map<string, RiskLevel>();
    sites.forEach((site) => {
      const forecastDay = day.bySiteId[site.id];
      if (!forecastDay) return;
      const group = groupBy(site);
      if (!group) return;
      const value = parameter === 'rainfall' ? forecastDay.expectedRainfallMm : forecastDay.maxTemp;
      const risk = getParameterRisk(parameter, value);
      worstByGroup.set(group, worseRisk(worstByGroup.get(group) ?? 'none', risk));
    });

    BULLETIN_SEVERITIES.forEach((sev) => {
      const names = Array.from(worstByGroup.entries())
        .filter(([, risk]) => risk === sev)
        .map(([name]) => name)
        .sort();
      result[sev].push(names);
    });
  });

  return result;
}

/** One hazard-peril row's cell: every affected group that day, each
 *  carrying its OWN severity (unlike the Rain/Wind matrix's one-row-per-
 *  severity shape) - matches the SOW sample's Hazard Prediction table,
 *  where a single day's cell for a region can show more than one state at
 *  more than one severity (e.g. "NES" in red next to "West Bengal" in
 *  orange, same day, same peril row). */
export interface HazardEntry {
  name: string;
  severity: BulletinSeverity;
}

export interface HazardPerilConfig {
  key: string;
  label: string;
  classify: (obs: CurrentObservation, site: Site) => RiskLevel;
}

// Cyclone is prepended separately (buildCycloneHazardRow below) since it
// isn't a per-site/per-observation reading like these five - it comes from
// the single tracked demo system's own district-warning list instead. Fog
// isn't part of this list even though it's tracked elsewhere in the app
// (Live Map, Alerts) - the SOW's own Hazard Prediction sample doesn't
// include it, and this bulletin is built to match that sample.
export const BULLETIN_HAZARD_PERILS: HazardPerilConfig[] = [
  { key: 'lightning', label: 'Lightning', classify: (o) => getParameterRisk('lightning', o.lightningStrikesLastHour) },
  { key: 'flooding', label: 'Flooding', classify: (o, s) => getFloodRisk(s, o) },
  { key: 'landslide', label: 'Landslide', classify: (o, s) => getLandslideRisk(s.elevationMeters, o.rainfallLastHour) },
  { key: 'avalanche', label: 'Avalanche', classify: (o, s) => getAvalancheRisk(s.elevationMeters, o.temperature, o.windSpeed) },
  { key: 'snowfall', label: 'Snowfall', classify: (o, s) => getSnowfallRisk(s.elevationMeters, o.temperature) },
];

export function buildHazardRow(
  sites: Site[],
  days: ForecastDaySnapshot[],
  peril: HazardPerilConfig,
  groupBy: (site: Site) => string | null
): HazardEntry[][] {
  const siteById = new Map(sites.map((s) => [s.id, s]));
  return days.map((day) => {
    const worstByGroup = new Map<string, RiskLevel>();
    day.observations.forEach((obs) => {
      const site = siteById.get(obs.siteId);
      if (!site) return;
      const group = groupBy(site);
      if (!group) return;
      const risk = peril.classify(obs, site);
      worstByGroup.set(group, worseRisk(worstByGroup.get(group) ?? 'none', risk));
    });
    return Array.from(worstByGroup.entries())
      .filter((entry): entry is [string, BulletinSeverity] => entry[1] !== 'none')
      .map(([name, severity]) => ({ name, severity }))
      .sort((a, b) => RISK_RANK[b.severity] - RISK_RANK[a.severity] || a.name.localeCompare(b.name));
  });
}

/**
 * Cyclone's own hazard row: derived from whatever real system
 * hazardData.ts's getActiveCyclone currently returns - `null` until a real
 * IMD/JTWC feed is wired in (see that function's own doc comment), in which
 * case every day comes back with an empty cell rather than a fabricated
 * reading. `groupNameForDistrict` maps a warned district to whatever this
 * bulletin groups by (its state, for the national view; itself, for the
 * circle view, when the district falls inside the selected circle).
 */
export function buildCycloneHazardRow(
  cyclone: CycloneSystem | null,
  days: ForecastDaySnapshot[],
  groupNameForDistrict: (district: string, state: string) => string | null
): HazardEntry[][] {
  if (!cyclone) return days.map(() => []);

  const groups = Array.from(
    new Set(
      cyclone.districtWarnings
        .map((w) => groupNameForDistrict(w.district, w.state))
        .filter((g): g is string => Boolean(g))
    )
  ).sort();

  return days.map((day) => {
    const dayDate = dayjs(day.at).startOf('day');
    const trackPoint = cyclone.track.find((p) => dayjs(p.at).isSame(dayDate, 'day'));
    if (!trackPoint || groups.length === 0) return [];
    const severity = cycloneWindSeverity(trackPoint.windKmph);
    if (!severity) return [];
    return groups.map((name) => ({ name, severity }));
  });
}

/**
 * Two short, auto-generated headline lines for the Daily Circle Bulletin,
 * matching the SOW sample's own "* There will be less chance of rainfall
 * in Gujarat for the next 3 days / * Rainfall will gradually increase
 * across Gujarat from 28th May" callout box. Derived directly from the
 * same rainfall data the tables below show (worst risk across the
 * circle's sites, per day) - not a separate narrative model, so it can
 * never say something the tables don't back up.
 */
export function buildCircleHeadlines(circleLabel: string, sites: Site[], days: ForecastDaySnapshot[]): string[] {
  const siteIds = new Set(sites.map((s) => s.id));
  const dayRisk: RiskLevel[] = days.map((day) => {
    let worst: RiskLevel = 'none';
    day.observations.forEach((obs) => {
      if (!siteIds.has(obs.siteId)) return;
      worst = worseRisk(worst, getParameterRisk('rainfall', obs.rainfallLastHour));
    });
    return worst;
  });

  const headlines: string[] = [];
  const shortRisk = dayRisk.slice(0, 3);
  if (shortRisk.every((r) => r === 'none')) {
    headlines.push(`There will be less chance of rainfall in ${circleLabel} for the next 3 days.`);
  } else {
    const worstShort = shortRisk.reduce(worseRisk, 'none' as RiskLevel);
    const label = worstShort === 'none' ? 'Light to moderate' : RAIN_WIND_SEVERITY_LABEL[worstShort as BulletinSeverity];
    headlines.push(`${label} rainfall is likely across ${circleLabel} over the next 3 days.`);
  }

  let stepUpIndex = -1;
  for (let i = 1; i < dayRisk.length; i += 1) {
    if (RISK_RANK[dayRisk[i]] > RISK_RANK[dayRisk[i - 1]]) {
      stepUpIndex = i;
      break;
    }
  }
  headlines.push(
    stepUpIndex > 0
      ? `Rainfall will gradually increase across ${circleLabel} from ${days[stepUpIndex].label}.`
      : `No significant change in rainfall risk is expected across ${circleLabel} over the next 7 days.`
  );

  return headlines;
}

/** Thresholds taken directly from the SOW's own Cyclone legend (kmph),
 *  rather than this app's separate 7-tier IMD-style classification
 *  (hazardData.ts's classifyCycloneWind) - the two aren't reconciled since
 *  the SOW gives its own explicit numbers for this bulletin's legend. */
function cycloneWindSeverity(windKmph: number): BulletinSeverity | null {
  if (windKmph >= 165) return 'warning';
  if (windKmph >= 117) return 'alert';
  if (windKmph >= 87) return 'watch';
  return null;
}
