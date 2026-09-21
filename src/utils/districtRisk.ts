import type { Site } from '@/features/sites/types';
import type { CurrentObservation } from '@/features/weather/types';
import { worseRisk, type RiskLevel } from './severity';

/** Lowercase, trim, and collapse whitespace/punctuation so names like
 *  "North  24-Parganas" and "North 24 Parganas" compare equal. Shared by
 *  every place that keys a lookup by district (or state) name: the Live
 *  Map's district-boundary matching, and the district-level risk
 *  aggregation below. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// This deployment's real `Site.state` value IS the circle name
// (INDUS_CIRCLES.State), and not every circle is a single real government
// state - two of the real circles cover TWO states each ("Bihar &
// Jharkhand", "Madhya Pradesh & Chhattisgarh"), and one is spelled
// differently than the boundary source ("Jammu Kashmir" vs "Jammu and
// Kashmir" - see districtGeo.ts's header for the boundary source itself).
// Left unhandled, a circle's sites never matched ANY polygon in
// india-states.json, so the Live Map's default view silently showed these
// circles as blank/unmonitored even though they have real towers. Keyed by
// normalizeName() so punctuation/spacing/case don't matter.
const CIRCLE_STATE_ALIASES: Record<string, string[]> = {
  'bihar jharkhand': ['Bihar', 'Jharkhand'],
  'bihar and jharkhand': ['Bihar', 'Jharkhand'],
  'madhya pradesh chhattisgarh': ['Madhya Pradesh', 'Chhattisgarh'],
  'madhya pradesh and chhattisgarh': ['Madhya Pradesh', 'Chhattisgarh'],
  'jammu kashmir': ['Jammu and Kashmir'],
  'jammu and kashmir': ['Jammu and Kashmir'],
};

/**
 * Splits one of this app's own `Site.state` (circle) values into the real
 * government state name(s) it actually covers, so the Live Map's default
 * state choropleth (StateOutlinesLayer) can shade EVERY real state a circle
 * spans, instead of failing to match at all. A circle that already IS a
 * single real state ("Maharashtra", "Karnataka", ...) splits into just
 * itself, unchanged. See `CIRCLE_STATE_ALIASES` above for the known
 * multi-state/misspelled circle names this currently handles - add an entry
 * there if a new circle name shows up ungrouped on the map.
 * <p>
 * When a circle covers more than one real state, every one of that circle's
 * sites is counted under EACH constituent state's polygon (both get the
 * same risk/average/site-count). That's deliberate: the circle doesn't
 * record which of its two states any given tower actually sits in, so both
 * polygons showing the circle's combined figures together - lighting up as
 * one region - is the most honest way to represent "this combined circle"
 * on a state-shaped map, rather than picking one state to arbitrarily "win".
 */
export function splitCircleStateName(rawState: string): string[] {
  const alias = CIRCLE_STATE_ALIASES[normalizeName(rawState)];
  if (alias) return alias;
  // Only split on an unambiguous "&" or "/" separator - never on the bare
  // word "and", which is part of several real state/UT names outright
  // ("Jammu and Kashmir", "Andaman and Nicobar Islands") and would be
  // wrongly torn in two by a blind word-level split.
  if (/[&/]/.test(rawState)) {
    const parts = rawState.split(/\s*[&/]\s*/).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) return parts;
  }
  return [rawState];
}

export interface DistrictRiskInfo {
  risk: RiskLevel;
  siteCount: number;
  /** For buildDistrictRiskIndex this is just the district name. For
   *  buildStateRiskIndex, `keyFor` groups by the SPLIT constituent name
   *  (e.g. "Bihar"), so this ends up being that split name too - NOT the
   *  original raw circle value. Kept for display; use `sourceValue` below
   *  for anything that has to round-trip back into a REST filter. */
  canonicalName: string;
  /** Average of a caller-supplied numeric reading (e.g. temperature) across
   *  every site folded into this entry - only set when `valueFn` is passed
   *  to buildDistrictRiskIndex/buildStateRiskIndex. Lets a map tooltip show
   *  an actual figure ("28.4°C avg"), not just a risk color. */
  avgValue?: number;
  /** buildStateRiskIndex only: the site's own raw, UNSPLIT `state` value
   *  (e.g. "Bihar & Jharkhand") that actually contributed to this entry.
   *  Every REST query (sites, observations, district boundaries) filters by
   *  that real DB value, not by `canonicalName`'s split name - so a caller
   *  that lets the user click into this state MUST use `sourceValue` (falling
   *  back to `canonicalName` only when it's undefined, e.g. an unmonitored
   *  polygon with no data at all). Undefined for buildDistrictRiskIndex,
   *  where no splitting happens and `canonicalName` is already correct. */
  sourceValue?: string;
}

interface RiskAccumulator extends DistrictRiskInfo {
  valueSum?: number;
}

/**
 * Shared aggregation: groups sites by whatever `keyFor` returns (one or more
 * district/state names a single site counts under - see
 * `splitCircleStateName` above for why a site can count under more than one
 * name) and combines each group's observations into one worst-risk-wins
 * entry (plus, optionally, a running average via `valueFn`), under whatever
 * `riskFn` the caller wants (a single parameter, an aggregate "overall"
 * risk, or a synthetic hazard like flood/snowfall/avalanche).
 * `buildDistrictRiskIndex` and `buildStateRiskIndex` below are both thin
 * wrappers over this - same aggregation rule at two different
 * administrative levels, so a state's color on the Live Map's default
 * (nothing-picked-yet) view and a district's color once that state is
 * picked never disagree about what "worst risk" means.
 */
function buildRiskIndex(
  sites: Site[],
  obsBySiteId: Record<string, CurrentObservation>,
  riskFn: (site: Site, obs: CurrentObservation) => RiskLevel,
  keyFor: (site: Site) => string[],
  valueFn?: (site: Site, obs: CurrentObservation) => number,
  sourceValueFor?: (site: Site) => string
): Map<string, DistrictRiskInfo> {
  const map = new Map<string, RiskAccumulator>();
  sites.forEach((site) => {
    const obs = obsBySiteId[site.id];
    if (!obs) return;
    const risk = riskFn(site, obs);
    const value = valueFn ? valueFn(site, obs) : undefined;
    const sourceValue = sourceValueFor ? sourceValueFor(site) : undefined;
    keyFor(site).forEach((name) => {
      const key = normalizeName(name);
      const prev = map.get(key);
      const siteCount = (prev?.siteCount ?? 0) + 1;
      const valueSum = value !== undefined ? (prev?.valueSum ?? 0) + value : prev?.valueSum;
      map.set(key, {
        risk: prev ? worseRisk(prev.risk, risk) : risk,
        siteCount,
        canonicalName: prev?.canonicalName ?? name,
        sourceValue: prev?.sourceValue ?? sourceValue,
        valueSum,
        avgValue: valueSum !== undefined ? valueSum / siteCount : undefined,
      });
    });
  });
  return map;
}

/**
 * Aggregates a set of sites' observations into one risk level per district
 * - a district's risk is the worst risk among its monitored sites. Shared by
 * the Live Map's district choropleth and the Hazards page's flood map /
 * risk-intensity tables so they never disagree about how "district risk" is
 * computed.
 */
export function buildDistrictRiskIndex(
  sites: Site[],
  obsBySiteId: Record<string, CurrentObservation>,
  riskFn: (site: Site, obs: CurrentObservation) => RiskLevel,
  valueFn?: (site: Site, obs: CurrentObservation) => number
): Map<string, DistrictRiskInfo> {
  return buildRiskIndex(sites, obsBySiteId, riskFn, (site) => [site.district], valueFn);
}

/**
 * Same aggregation as `buildDistrictRiskIndex`, one level up: one risk level
 * per real STATE, the worst among all of that state's monitored sites
 * regardless of which district they're in. Drives the Live Map's default
 * (Pan-India, nothing picked yet) StateOutlinesLayer coloring, so every
 * state visibly reflects its own worst current condition - and, scrubbing
 * the timeline's hourly slider, visibly changes color as that condition
 * changes hour to hour - even before drilling into any one state's
 * district-level detail.
 * <p>
 * Keys by `splitCircleStateName(site.state)` rather than the raw
 * `site.state` value directly, so a combined circle like "Bihar & Jharkhand"
 * lights up BOTH the Bihar and Jharkhand polygons together with that
 * circle's own figures, instead of matching neither.
 */
export function buildStateRiskIndex(
  sites: Site[],
  obsBySiteId: Record<string, CurrentObservation>,
  riskFn: (site: Site, obs: CurrentObservation) => RiskLevel,
  valueFn?: (site: Site, obs: CurrentObservation) => number
): Map<string, DistrictRiskInfo> {
  return buildRiskIndex(
    sites,
    obsBySiteId,
    riskFn,
    (site) => splitCircleStateName(site.state),
    valueFn,
    (site) => site.state
  );
}
