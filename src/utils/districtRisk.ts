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
// state - four of the real circles cover TWO states/UTs each ("Bihar &
// Jharkhand", "Madhya Pradesh & Chhattisgarh", the "Jammu Kashmir" circle
// (spans both Jammu and Kashmir AND Ladakh - the two UTs India split it into
// in 2019, both still monitored under this one combined circle value in the
// real table), and the plain "Tamil Nadu" circle (see the 2026-09-30 entry
// below - it also covers real Puducherry UT towers). Left unhandled, a
// circle's sites never matched ANY polygon in india-states.json (or matched
// only ONE of its two real UTs), so the Live Map's default view silently
// showed the unmatched state(s) as blank/unmonitored even though they have
// real towers. Keyed by normalizeName() so punctuation/spacing/case don't
// matter.
// <p>
// Correction, 2026-09-22: Ladakh was previously left OUT of this circle's
// entry entirely (single-element `['Jammu and Kashmir']`), on the mistaken
// assumption - based on an earlier report that read as "Ladakh isn't in the
// table" - that no real Ladakh-area towers existed. The user confirmed the
// opposite (real Leh/Kargil tower data does exist, under this same combined
// circle) and asked for the district boundaries to actually be drawn there.
// Ladakh is now listed as a second constituent state here, exactly like
// Bihar/Jharkhand and Madhya Pradesh/Chhattisgarh above - this is what makes
// `LiveMapPage.tsx`'s `constituentStates` (via `splitCircleStateName`) fetch
// BOTH `jammu-and-kashmir.json` AND `ladakh.json` (Kargil + Leh (ladakh))
// when this circle is selected, instead of only the first file.
// <p>
// Added 2026-09-30 ("in live-map... some district have show grey colors"):
// a user-run `SELECT DISTINCT State, District FROM indus_locations` showed
// the plain "Tamil Nadu" circle's own real rows include `District` values
// "Karaikal", "Pondicherry", and "Puducherry" - all three real districts of
// the Puducherry UT (confirmed against `public/data/districts/puducherry.json`,
// which lists exactly Mahe/Karaikal/Puducherry/Yanam), not Tamil Nadu
// districts at all. Since "Tamil Nadu" has no "&"/"/" for
// `splitCircleStateName`'s generic fallback to split on, and carried no
// explicit alias here, this circle only ever fetched `tamil-nadu.json` -
// meaning any real Karaikal/Puducherry/Pondicherry tower's coordinates could
// never fall inside ANY loaded polygon (Puducherry's shape was never even
// fetched), guaranteeing those towers' districts render gray/no-data on the
// plain Live Map choropleth every time, regardless of how healthy their live
// readings are. Listed as a second constituent state here, same pattern as
// the three circles above, so `constituentStates` now fetches BOTH
// `tamil-nadu.json` AND `puducherry.json` for this circle.
const CIRCLE_STATE_ALIASES: Record<string, string[]> = {
  'bihar jharkhand': ['Bihar', 'Jharkhand'],
  'bihar and jharkhand': ['Bihar', 'Jharkhand'],
  'madhya pradesh chhattisgarh': ['Madhya Pradesh', 'Chhattisgarh'],
  'madhya pradesh and chhattisgarh': ['Madhya Pradesh', 'Chhattisgarh'],
  'jammu kashmir': ['Jammu and Kashmir', 'Ladakh'],
  'jammu and kashmir': ['Jammu and Kashmir', 'Ladakh'],
  'tamil nadu': ['Tamil Nadu', 'Puducherry'],
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

// Hardcoded reverse of the multi-state entries in CIRCLE_STATE_ALIASES above
// (the exact real raw circle spellings confirmed against the actual Indus
// dataset - see the National/Circle Bulletin region-mapping fix for the same
// confirmed spellings). Deliberately NOT derived from currently-loaded site
// data: `riskScopeSites` (LiveMapPage's nationwide site list) narrows down
// to just ONE circle's sites the instant a state is picked, which would
// silently drop every OTHER state's entry from a site-data-only map right
// when the user might switch straight to a different state from the
// dropdown. This table is always complete regardless of what's currently
// selected or loaded.
const KNOWN_COMBINED_CIRCLE_VALUES: Record<string, string> = {
  bihar: 'Bihar & Jharkhand',
  jharkhand: 'Bihar & Jharkhand',
  'madhya pradesh': 'Madhya Pradesh & Chhattisgarh',
  chhattisgarh: 'Madhya Pradesh & Chhattisgarh',
  'jammu and kashmir': 'Jammu Kashmir',
  // Added alongside the CIRCLE_STATE_ALIASES fix above - clicking the Ladakh
  // polygon now resolves back to this same raw circle value, same as
  // clicking the Jammu and Kashmir polygon does, so both show that one
  // circle's real towers instead of "Ladakh" silently filtering for a state
  // value no site actually has.
  ladakh: 'Jammu Kashmir',
  // Added 2026-09-30 alongside the Puducherry CIRCLE_STATE_ALIASES fix above,
  // for the same reason Ladakh was added: clicking the Puducherry polygon
  // (nationwide state-outline view) now resolves back to the real "Tamil
  // Nadu" circle value, instead of "Puducherry" silently filtering for a
  // state value no site actually has.
  puducherry: 'Tamil Nadu',
};

/**
 * Maps every real government state/UT name (normalizeName'd) to the actual
 * raw `Site.state` (circle) value that has to be used in a REST filter to
 * find that state's sites - e.g. both "madhya pradesh" and "chhattisgarh"
 * map to the literal string "Madhya Pradesh & Chhattisgarh", since that's
 * the only value any of those sites' `state` field actually holds.
 * <p>
 * This exists because `buildStateRiskIndex`'s own `sourceValue` (see
 * `DistrictRiskInfo` above) is only populated for a state that currently has
 * at least one site WITH a live observation at the exact instant being
 * queried (`buildRiskIndex` skips any site with no `obs` entirely) - so a
 * combined circle whose sites simply don't have a reading for the currently
 * selected hour/day (or haven't been fetched yet) silently loses its
 * `sourceValue`, and a caller falling back to the plain split state name
 * (e.g. "Madhya Pradesh") for its own REST query gets zero results even
 * though the state has real, just-not-currently-observed towers.
 * <p>
 * Seeded with the always-correct `KNOWN_COMBINED_CIRCLE_VALUES` table above,
 * then overlaid with whatever `sites` confirms - so it's always at least as
 * complete as the static table, and picks up any newly-added combined
 * circle this table doesn't know about yet, for as long as that circle's own
 * sites happen to be in the currently-loaded list.
 */
export function buildStateSourceMap(sites: Site[]): Map<string, string> {
  const map = new Map<string, string>(Object.entries(KNOWN_COMBINED_CIRCLE_VALUES));
  sites.forEach((site) => {
    splitCircleStateName(site.state).forEach((name) => {
      map.set(normalizeName(name), site.state);
    });
  });
  return map;
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
  /** Circular mean (not a plain arithmetic mean - see `buildRiskIndex`'s own
   *  comment on why) of a caller-supplied degrees reading (wind direction,
   *  0-359) across every site folded into this entry - only set when
   *  `directionValueFn` is passed to buildDistrictRiskIndex/
   *  buildStateRiskIndex. Added 2026-09-22 so the wind-speed map tooltip can
   *  show a real averaged direction alongside the averaged speed, not speed
   *  alone. */
  avgDirectionDegrees?: number;
  /** Plain arithmetic mean (NOT a circular mean - gust is a magnitude in
   *  km/h, not a compass angle, so it averages the same simple sum/count
   *  way `avgValue` does) of a caller-supplied wind-gust reading across
   *  every site folded into this entry - only set when `gustValueFn` is
   *  passed to buildDistrictRiskIndex/buildStateRiskIndex. Added
   *  2026-09-22 so the wind-speed map tooltip can show gust as its own,
   *  separate figure alongside sustained speed and direction, per explicit
   *  request ("i need seperate index of wing speed and directions and
   *  gust"). `CurrentObservation.windGust` is already a real per-site
   *  km/h reading (real Indus `wind_gusts_10m` data whenever Indus is
   *  enabled, the same synthetic per-hour figure as windSpeed otherwise) -
   *  this just averages it the way avgValue already averages windSpeed. */
  avgGust?: number;
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
  /** How many sites actually contributed to `valueSum` - added 2026-09-29
   *  alongside `layerGradientValue()` (mapLayers.ts), which can now return
   *  `undefined` for a site with no real reading (snowfall, most sites,
   *  outside real Indus snow data) while `siteCount` above still counts
   *  EVERY site in the group regardless. `avgValue` below divides by this,
   *  not `siteCount`, so a district with, say, 2 of 50 sites reporting real
   *  snowfall averages those 2 sites' own readings together - not silently
   *  diluted by the other 48 contributing nothing to the sum. Every
   *  pre-existing caller's `valueFn` always returns a real number for any
   *  site it's called on, so `valueCount` equals `siteCount` for all of
   *  them and this is a no-op change in practice for anything but
   *  snowfall. */
  valueCount?: number;
  /** Running sum of sin/cos components for `avgDirectionDegrees`'s circular
   *  mean - see `buildRiskIndex`'s comment below for why a degrees reading
   *  can't just be summed and divided like `valueSum` above. */
  directionSinSum?: number;
  directionCosSum?: number;
  /** Running sum for `avgGust`'s plain arithmetic mean - same shape as
   *  `valueSum` above, kept as its own accumulator since a district/state's
   *  gust average is independent of whichever reading `valueFn` itself is
   *  averaging (windSpeed, for the wind layer). */
  gustSum?: number;
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
 *
 * `directionValueFn`, if passed, averages a degrees reading (wind
 * direction, 0-359) the same way `valueFn` averages a plain magnitude - but
 * NOT via a simple sum-then-divide, since degrees wrap around: naively
 * averaging 350° and 10° (both roughly due-north) as (350+10)/2 = 180°
 * would report the mean direction as due SOUTH, the opposite of correct.
 * Instead each reading is decomposed into its sine/cosine components, those
 * are summed and divided separately (same running-average shape as
 * `valueSum`, just two accumulators instead of one), and the final average
 * direction is recovered via `atan2` - the standard circular-mean
 * construction, normalized back into [0, 360).
 *
 * `gustValueFn`, if passed, averages a second plain magnitude (wind gust,
 * km/h) completely independently of `valueFn` - same running-sum/divide
 * shape as `valueFn`/`avgValue` (no circular-mean handling needed, unlike
 * direction), just its own accumulator so a district/state can report gust
 * as its own figure alongside whichever reading `valueFn` itself averages.
 *
 * Exported (2026-09-30) so `LiveMapPage.tsx`'s plain (non-Indus) district
 * index can call it directly with a two-key `keyFor` - one geography-
 * resolved key plus the site's raw `district` field - instead of going
 * through `buildDistrictRiskIndex`'s single-key `districtFor`. That lets a
 * tower whose raw DB district text names a REAL district polygon that its
 * coordinates don't happen to fall inside (e.g. Sheohar, Ganderbal - see
 * that file's own comment for the coordinate evidence) light up its own
 * true polygon in ADDITION to whichever neighboring polygon it
 * geo-resolves into, without removing that tower from the neighboring
 * polygon's count. Every existing caller (`buildDistrictRiskIndex`,
 * `buildStateRiskIndex`) is unaffected - this just makes the same function
 * callable directly by one more site.
 */
export function buildRiskIndex(
  sites: Site[],
  obsBySiteId: Record<string, CurrentObservation>,
  riskFn: (site: Site, obs: CurrentObservation) => RiskLevel,
  keyFor: (site: Site) => string[],
  // Widened to `number | undefined` 2026-09-29 alongside `layerGradientValue()`
  // (mapLayers.ts), which can genuinely return `undefined` for a site with
  // no real reading to grade by (snowfall, most sites) - see this
  // function's own accumulation logic just below (`value !== undefined`
  // checks) and `valueCount`'s own comment above for how an undefined
  // value is excluded from the average rather than treated as zero. A pure
  // type widening - every pre-existing caller already always returns a
  // real `number`, which remains perfectly valid here.
  valueFn?: (site: Site, obs: CurrentObservation) => number | undefined,
  sourceValueFor?: (site: Site) => string,
  directionValueFn?: (site: Site, obs: CurrentObservation) => number,
  gustValueFn?: (site: Site, obs: CurrentObservation) => number
): Map<string, DistrictRiskInfo> {
  const map = new Map<string, RiskAccumulator>();
  sites.forEach((site) => {
    const obs = obsBySiteId[site.id];
    if (!obs) return;
    const risk = riskFn(site, obs);
    const value = valueFn ? valueFn(site, obs) : undefined;
    const sourceValue = sourceValueFor ? sourceValueFor(site) : undefined;
    const directionDegrees = directionValueFn ? directionValueFn(site, obs) : undefined;
    const directionRadians = directionDegrees !== undefined ? (directionDegrees * Math.PI) / 180 : undefined;
    const gustValue = gustValueFn ? gustValueFn(site, obs) : undefined;
    keyFor(site).forEach((name) => {
      const key = normalizeName(name);
      const prev = map.get(key);
      const siteCount = (prev?.siteCount ?? 0) + 1;
      const valueSum = value !== undefined ? (prev?.valueSum ?? 0) + value : prev?.valueSum;
      const valueCount = value !== undefined ? (prev?.valueCount ?? 0) + 1 : prev?.valueCount;
      const directionSinSum =
        directionRadians !== undefined ? (prev?.directionSinSum ?? 0) + Math.sin(directionRadians) : prev?.directionSinSum;
      const directionCosSum =
        directionRadians !== undefined ? (prev?.directionCosSum ?? 0) + Math.cos(directionRadians) : prev?.directionCosSum;
      const avgDirectionDegrees =
        directionSinSum !== undefined && directionCosSum !== undefined
          ? (((Math.atan2(directionSinSum / siteCount, directionCosSum / siteCount) * 180) / Math.PI) + 360) % 360
          : undefined;
      const gustSum = gustValue !== undefined ? (prev?.gustSum ?? 0) + gustValue : prev?.gustSum;
      map.set(key, {
        risk: prev ? worseRisk(prev.risk, risk) : risk,
        siteCount,
        canonicalName: prev?.canonicalName ?? name,
        sourceValue: prev?.sourceValue ?? sourceValue,
        valueSum,
        valueCount,
        avgValue: valueSum !== undefined && valueCount ? valueSum / valueCount : undefined,
        directionSinSum,
        directionCosSum,
        avgDirectionDegrees,
        gustSum,
        avgGust: gustSum !== undefined ? gustSum / siteCount : undefined,
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
  // Widened to `number | undefined` 2026-09-29 alongside `layerGradientValue()`
  // (mapLayers.ts), which can genuinely return `undefined` for a site with
  // no real reading to grade by (snowfall, most sites) - see this
  // function's own accumulation logic just below (`value !== undefined`
  // checks) and `valueCount`'s own comment above for how an undefined
  // value is excluded from the average rather than treated as zero. A pure
  // type widening - every pre-existing caller already always returns a
  // real `number`, which remains perfectly valid here.
  valueFn?: (site: Site, obs: CurrentObservation) => number | undefined,
  directionValueFn?: (site: Site, obs: CurrentObservation) => number,
  gustValueFn?: (site: Site, obs: CurrentObservation) => number,
  /** Resolves which district a site actually counts under - defaults to the
   *  site's own recorded `district` field (unchanged behavior for every
   *  existing caller that doesn't pass this). The Live Map passes a
   *  resolver keyed off each site's real GPS coordinates against the actual
   *  government boundary polygons instead (see live-map/geoDistrict.ts's
   *  `resolveGeoDistricts`), so a tower's on-map district assignment
   *  reflects where it actually is - added per explicit request ("do not
   *  let a tower's existing district field override its actual map
   *  location... if 40-50 towers are geographically in another district,
   *  they should appear in that other district's circle/color, even if the
   *  source data currently says Patna"). */
  districtFor?: (site: Site) => string
): Map<string, DistrictRiskInfo> {
  return buildRiskIndex(
    sites,
    obsBySiteId,
    riskFn,
    (site) => [districtFor ? districtFor(site) : site.district],
    valueFn,
    undefined,
    directionValueFn,
    gustValueFn
  );
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
  // Widened to `number | undefined` 2026-09-29 alongside `layerGradientValue()`
  // (mapLayers.ts), which can genuinely return `undefined` for a site with
  // no real reading to grade by (snowfall, most sites) - see this
  // function's own accumulation logic just below (`value !== undefined`
  // checks) and `valueCount`'s own comment above for how an undefined
  // value is excluded from the average rather than treated as zero. A pure
  // type widening - every pre-existing caller already always returns a
  // real `number`, which remains perfectly valid here.
  valueFn?: (site: Site, obs: CurrentObservation) => number | undefined,
  directionValueFn?: (site: Site, obs: CurrentObservation) => number,
  gustValueFn?: (site: Site, obs: CurrentObservation) => number
): Map<string, DistrictRiskInfo> {
  return buildRiskIndex(
    sites,
    obsBySiteId,
    riskFn,
    (site) => splitCircleStateName(site.state),
    valueFn,
    (site) => site.state,
    directionValueFn,
    gustValueFn
  );
}
