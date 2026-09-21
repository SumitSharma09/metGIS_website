import type { Site } from '@/features/sites/types';
import type { CurrentObservation } from '@/features/weather/types';
import { getParameterRisk, RISK_RANK, worseRisk, type RiskLevel } from '@/utils/severity';
import { buildDistrictRiskIndex, type DistrictRiskInfo } from '@/utils/districtRisk';
import { layerRisk } from '@/pages/live-map/mapLayers';
import type { ForecastDaySnapshot } from '@/pages/reports/useSevenDayObservations';

/* ------------------------------------------------------------------ */
/* Cyclone (no real feed wired up yet - see getActiveCyclone below)     */
/* ------------------------------------------------------------------ */

export type CycloneClassification =
  | 'Low Pressure Area'
  | 'Depression'
  | 'Deep Depression'
  | 'Cyclonic Storm'
  | 'Severe Cyclonic Storm'
  | 'Very Severe Cyclonic Storm'
  | 'Super Cyclonic Storm';

// Approximate, illustrative wind-speed bands (kmph) - not IMD's official
// scale, which is defined in knots/kt sustained wind.
const CYCLONE_BANDS: { min: number; classification: CycloneClassification }[] = [
  { min: 222, classification: 'Super Cyclonic Storm' },
  { min: 166, classification: 'Very Severe Cyclonic Storm' },
  { min: 118, classification: 'Severe Cyclonic Storm' },
  { min: 89, classification: 'Cyclonic Storm' },
  { min: 62, classification: 'Deep Depression' },
  { min: 51, classification: 'Depression' },
  { min: 0, classification: 'Low Pressure Area' },
];

export function classifyCycloneWind(windKmph: number): CycloneClassification {
  return CYCLONE_BANDS.find((b) => windKmph >= b.min)?.classification ?? 'Low Pressure Area';
}

// Illustrative "likely-affected" radius per category (km) - like the wind
// bands above, this is a rough, demo-only stand-in for IMD's own damage/
// wind-extent radii (which vary bulletin to bulletin and aren't a fixed
// table), used only to size each track point's affected-area circle on the
// map so a stronger system visibly covers more ground than a weaker one.
const CYCLONE_IMPACT_RADIUS_KM: Record<CycloneClassification, number> = {
  'Low Pressure Area': 50,
  Depression: 70,
  'Deep Depression': 90,
  'Cyclonic Storm': 120,
  'Severe Cyclonic Storm': 160,
  'Very Severe Cyclonic Storm': 200,
  'Super Cyclonic Storm': 250,
};

export function cycloneImpactRadiusKm(classification: CycloneClassification): number {
  return CYCLONE_IMPACT_RADIUS_KM[classification];
}

export interface CycloneTrackPoint {
  lat: number;
  lng: number;
  windKmph: number;
  classification: CycloneClassification;
  at: string; // ISO
  observed: boolean;
}

export interface CycloneDistrictWarning {
  state: string;
  district: string;
  level: RiskLevel; // reuses the shared scale: warning/alert/watch/none
}

export interface CycloneSystem {
  name: string;
  /** The bulletin identifier this system is currently being tracked under
   *  (e.g. IMD's "Special Cyclone Alert Bulletin No. 7") - shown alongside
   *  `name` wherever this system is referenced, so the UI names the actual
   *  event and its current advisory rather than just the generic word
   *  "Cyclone"/"Hazard". */
  advisory: string;
  basin: string;
  track: CycloneTrackPoint[];
  districtWarnings: CycloneDistrictWarning[];
}

/** Labels for the shared RiskLevel scale in the specific "what to do about
 *  it" phrasing the scope document's Cyclone Map legend uses. */
export const CYCLONE_WARNING_LABEL: Record<RiskLevel, string> = {
  warning: 'Warning (Take Action)',
  alert: 'Alert (Be Prepared)',
  watch: 'Watch (Be Updated)',
  none: 'No Warning (No Action)',
};

/**
 * There is no real cyclone feed (IMD/JTWC) wired up yet, and per explicit
 * instruction this page must never fabricate or simulate hazard data while
 * that's the case - a previous version of this function returned a fixed,
 * deterministically-seeded demo storm ("Cyclonic Storm ASANI (demo)") to
 * illustrate the Cyclone Map UI, which is exactly the kind of stand-in data
 * that's no longer acceptable here. This returns `null` (no active system)
 * until a real feed is integrated - callers show an honest "no live cyclone
 * data" state instead of a track, matching how every other hazard already
 * shows "no data" gray rather than a guessed reading. Swap this function's
 * body for a real feed integration (parsing real bulletins into
 * `CycloneSystem`) when one is available.
 */
export function getActiveCyclone(): CycloneSystem | null {
  return null;
}

/* ------------------------------------------------------------------ */
/* Flood risk (derived from rainfall - no separate hydrological model)  */
/* ------------------------------------------------------------------ */

export function getFloodRisk(_site: Site, obs: CurrentObservation): RiskLevel {
  return getParameterRisk('rainfall', obs.rainfallLastHour);
}

/* ------------------------------------------------------------------ */
/* Today's Risk Intensity of Districts (weather parameters + hazards)   */
/* ------------------------------------------------------------------ */

export interface RiskIntensityRow {
  key: string;
  label: string;
  bands: Record<RiskLevel, string[]>; // district names, per band
}

function toRows(
  sites: Site[],
  obsBySiteId: Record<string, CurrentObservation>,
  entries: { key: string; label: string; riskFn: (site: Site, obs: CurrentObservation) => RiskLevel }[]
): RiskIntensityRow[] {
  return entries.map(({ key, label, riskFn }) => {
    const perDistrict = buildDistrictRiskIndex(sites, obsBySiteId, riskFn);
    const bands: Record<RiskLevel, string[]> = { warning: [], alert: [], watch: [], none: [] };
    perDistrict.forEach((info: DistrictRiskInfo) => {
      bands[info.risk].push(info.canonicalName);
    });
    (Object.keys(bands) as RiskLevel[]).forEach((k) => bands[k].sort());
    return { key, label, bands };
  });
}

export function buildWeatherParameterRiskRows(
  sites: Site[],
  obsBySiteId: Record<string, CurrentObservation>
): RiskIntensityRow[] {
  return toRows(sites, obsBySiteId, [
    { key: 'rainfall', label: 'Rainfall', riskFn: (_s, o) => getParameterRisk('rainfall', o.rainfallLastHour) },
    { key: 'wind', label: 'Wind', riskFn: (_s, o) => getParameterRisk('windSpeed', o.windSpeed) },
    { key: 'humidity', label: 'Humidity', riskFn: (_s, o) => getParameterRisk('humidity', o.humidity) },
    { key: 'visibility', label: 'Visibility', riskFn: (_s, o) => layerRisk('visibility', o) },
    { key: 'temperature', label: 'Temperature', riskFn: (_s, o) => getParameterRisk('temperature', o.temperature) },
  ]);
}

export function buildHazardRiskRows(
  sites: Site[],
  obsBySiteId: Record<string, CurrentObservation>,
  cyclone: CycloneSystem | null
): RiskIntensityRow[] {
  const rows = toRows(sites, obsBySiteId, [
    { key: 'lightning', label: 'Lightning', riskFn: (_s, o) => getParameterRisk('lightning', o.lightningStrikesLastHour) },
    { key: 'flood', label: 'Flood', riskFn: getFloodRisk },
    { key: 'fog', label: 'Fog', riskFn: (_s, o) => layerRisk('fog', o) },
    { key: 'snowfall', label: 'Snowfall', riskFn: (s, o) => layerRisk('snowfall', o, s) },
    { key: 'avalanche', label: 'Avalanche', riskFn: (s, o) => layerRisk('avalanche', o, s) },
  ]);

  // No fabricated row when there's no real, live cyclone system (see
  // getActiveCyclone's own doc comment) - an empty table row would either
  // have to be invented (bad) or silently say "no warnings" for a hazard
  // this app isn't actually tracking yet, which reads as a false all-clear.
  // Simplest honest answer: leave the row out entirely until real data
  // exists.
  if (cyclone) {
    const cycloneBands: Record<RiskLevel, string[]> = { warning: [], alert: [], watch: [], none: [] };
    cyclone.districtWarnings.forEach((w) => cycloneBands[w.level].push(w.district));
    (Object.keys(cycloneBands) as RiskLevel[]).forEach((k) => cycloneBands[k].sort());
    // Names the actual system and its current bulletin here, instead of the
    // generic word "Cyclone" - every other row in this table is a genuine
    // hazard *type* (Lightning, Flood, ...), but this one row is tracking
    // one specific, named real-world event, so it should read like an
    // advisory, not a category.
    rows.splice(1, 0, { key: 'cyclone', label: `${cyclone.name} — ${cyclone.advisory}`, bands: cycloneBands });
  }

  return rows;
}

/* ------------------------------------------------------------------ */
/* Weekly advisories (monsoon-preparation style bulletin)               */
/* ------------------------------------------------------------------ */

/**
 * Exported for reuse by the Reports page's Daily National Bulletin (see
 * reports/bulletinData.ts), which groups its Rain/Wind/Hazard tables by
 * the same North/East/West/South/Central/Northeast macro-regions this
 * weekly advisory bulletin already uses - one shared regional taxonomy
 * rather than two different ones for two bulletin views.
 */
export const STATE_REGION: Record<string, string> = {
  Maharashtra: 'West',
  Delhi: 'North',
  Haryana: 'North',
  Karnataka: 'South',
  'Tamil Nadu': 'South',
  Telangana: 'South',
  'West Bengal': 'East',
  Gujarat: 'West',
  Rajasthan: 'North',
  'Uttar Pradesh': 'North',
  'Madhya Pradesh': 'Central',
  Bihar: 'East',
  Assam: 'Northeast',
  Chandigarh: 'North',
  Kerala: 'South',
  'Andhra Pradesh': 'South',
  Chhattisgarh: 'Central',
  Goa: 'West',
  'Himachal Pradesh': 'North',
  Jharkhand: 'East',
  Odisha: 'East',
  Punjab: 'North',
  Uttarakhand: 'North',
};

const RAINFALL_OUTLOOK_LABEL: Record<RiskLevel, string> = {
  warning: 'Extremely Heavy',
  alert: 'Very Heavy',
  watch: 'Heavy',
  none: 'Light to Moderate',
};

export interface WeeklyAdvisoryRow {
  region: string;
  circle: string;
  rainfallOutlook: string;
  windOutlook: string;
  severity: RiskLevel;
  days: { label: string; risk: RiskLevel }[];
  summary: string;
}

export function buildWeeklyAdvisories(sites: Site[], days: ForecastDaySnapshot[]): WeeklyAdvisoryRow[] {
  const circles = Array.from(new Set(sites.map((s) => s.circle))).sort();
  const siteById = new Map(sites.map((s) => [s.id, s]));

  return circles.map((circle) => {
    const circleSites = sites.filter((s) => s.circle === circle);
    const region = STATE_REGION[circleSites[0]?.state ?? ''] ?? 'Pan-India';

    const dayRisks = days.map((day) => {
      let worst: RiskLevel = 'none';
      day.observations.forEach((obs) => {
        const site = siteById.get(obs.siteId);
        if (site && site.circle === circle) {
          worst = worseRisk(worst, getParameterRisk('rainfall', obs.rainfallLastHour));
        }
      });
      return { label: day.label, risk: worst };
    });

    const windRisks = days.map((day) => {
      let worst: RiskLevel = 'none';
      day.observations.forEach((obs) => {
        const site = siteById.get(obs.siteId);
        if (site && site.circle === circle) {
          worst = worseRisk(worst, getParameterRisk('windSpeed', obs.windSpeed));
        }
      });
      return worst;
    });

    const severity = dayRisks.reduce<RiskLevel>((acc, d) => worseRisk(acc, d.risk), 'none');
    const windSeverity = windRisks.reduce<RiskLevel>((acc, r) => worseRisk(acc, r), 'none');

    const worstDays = dayRisks.filter((d) => RISK_RANK[d.risk] === RISK_RANK[severity] && severity !== 'none');
    const summary =
      severity === 'none'
        ? `No significant rainfall or wind risk expected over ${circle} in the next ${days.length} days.`
        : `${RAINFALL_OUTLOOK_LABEL[severity]} rainfall expected over ${circle} on ${worstDays
            .map((d) => d.label)
            .join(', ')}${windSeverity !== 'none' ? ', with thunderstorms, lightning & gusty winds likely' : ''}.`;

    return {
      region,
      circle,
      rainfallOutlook: RAINFALL_OUTLOOK_LABEL[severity],
      windOutlook: windSeverity === 'none' ? 'No significant wind risk' : 'Thunderstorms, lightning & gusty winds',
      severity,
      days: dayRisks,
      summary,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Current Day advisory (today's line out of the same weekly bulletin)  */
/* ------------------------------------------------------------------ */

export interface CurrentDayAdvisoryRow {
  region: string;
  circle: string;
  severity: RiskLevel;
  rainfallOutlook: string;
  windOutlook: string;
  summary: string;
}

/**
 * The scope document's "Daily Weather Alerts Report" and its weekly
 * monsoon-preparation bulletin are the same underlying per-circle risk
 * data at two different granularities - today's line is just offset 0 of
 * the weekly one - so this reads it back out of `buildWeeklyAdvisories`'s
 * own output instead of re-deriving it from scratch (and firing a second,
 * redundant pass over every site's observations).
 */
export function buildCurrentDayAdvisories(weekly: WeeklyAdvisoryRow[]): CurrentDayAdvisoryRow[] {
  return weekly.map((row) => {
    const today = row.days[0];
    const severity = today?.risk ?? 'none';
    const summary =
      severity === 'none'
        ? `No significant rainfall or wind risk expected over ${row.circle} today.`
        : `${RAINFALL_OUTLOOK_LABEL[severity]} rainfall risk over ${row.circle} today${
            row.windOutlook !== 'No significant wind risk' ? ', with thunderstorms, lightning & gusty winds possible' : ''
          }.`;
    return {
      region: row.region,
      circle: row.circle,
      severity,
      rainfallOutlook: RAINFALL_OUTLOOK_LABEL[severity],
      windOutlook: row.windOutlook,
      summary,
    };
  });
}
