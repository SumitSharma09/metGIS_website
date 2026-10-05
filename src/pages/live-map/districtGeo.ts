/**
 * Real India state + district boundary polygons, served as static GeoJSON
 * files shipped with this app's own frontend build (public/data/) rather
 * than fetched from a third party at runtime.
 *
 * Source: Datameet's `maps` repository (https://github.com/datameet/maps),
 * `Survey-of-India-Index-Maps/Boundaries/` folder - `India-States.shp` and
 * `India-Districts-2011Census.shp`, licensed CC BY 4.0. These are digitized
 * from actual Survey of India index maps, which is the government mapping
 * authority whose boundaries are the ones actually approved for use in
 * India - unlike the boundary source this app used previously
 * (udit-001/india-maps-data), which carries no such provenance and is not
 * an authorized source for depicting India's administrative boundaries.
 *
 * The raw shapefiles were converted to GeoJSON, simplified, and split into
 * one small per-state district file (see docs/generate_boundaries.py,
 * docs/shp_to_geojson.py, docs/simplify_geojson.py in this repo for the
 * exact, dependency-free pipeline used - this sandbox's pip mirror doesn't
 * carry pyshp/fiona/gdal, so the shapefile parsing and Douglas-Peucker
 * simplification were both hand-written). That build step also:
 *  - canonicalizes a handful of state names to match this app's own
 *    spelling (e.g. "NCT of Delhi" -> "Delhi");
 *  - splits the pre-2014 undivided "Andhra Pradesh" district set into
 *    Andhra Pradesh + Telangana (this 2011-census-era file predates
 *    Telangana's 2014 formation);
 *  - splits the pre-2019 combined "Jammu and Kashmir" district set into
 *    Jammu and Kashmir + Ladakh (predates the 2019 Reorganisation Act).
 * Both splits happen once at build time now, not per-load in the browser
 * (the previous source needed a runtime Ladakh filter for the same reason -
 * see git history on this file).
 *
 * Feature property keys shipped in these files: `st_nm` (state features and
 * district features both), plus `district` (district features only).
 *
 * NOTE (stale as of 2026-09-22, kept for history): this used to say the
 * state-level file had no separate Ladakh outline, since the Survey of India
 * state-level index map predates the 2019 split. That's since been fixed -
 * `india-states.json` now ships a real, separately-derived Ladakh polygon
 * too (dissolved from Ladakh's own already-correctly-split district
 * polygons - see `docs/generate_boundaries.py`'s `dissolve_outer_ring()` -
 * rather than trusting this source's stale undivided state-level file for
 * just these two). 37 state/UT features total, Ladakh included.
 */

import { normalizeName } from '@/utils/districtRisk';

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function districtGeoJsonUrl(stateName: string): string {
  return `/data/districts/${slug(stateName)}.json`;
}

const INDIA_STATES_URL = '/data/india-states.json';

export type DistrictFeature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;
export type DistrictFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>;

function firstString(props: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = props[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return undefined;
}

/** Pulls {state, district} out of a district feature's properties. */
export function extractNames(feature: DistrictFeature): { state: string; district: string } | null {
  const props = feature.properties ?? {};
  const state = firstString(props, ['st_nm', 'STATE', 'state', 'NAME_1']);
  const district = firstString(props, ['district', 'DISTRICT', 'NAME_2', 'dtname']);
  if (!state || !district) return null;
  return { state, district };
}

/** Pulls just the state name out of a state-level feature's properties
 *  (india-states.json - these features have no `district` key). */
export function extractStateName(feature: DistrictFeature): string | undefined {
  const props = feature.properties ?? {};
  return firstString(props, ['st_nm', 'STATE', 'state', 'NAME_1']);
}

// Known spelling differences between the boundary source and the
// district/state names used in our own site records (renames, combined vs.
// split districts, older Census-era spellings). Keyed by
// `${normalizedBoundaryDistrict}|${normalizedState}` so a name is only
// remapped within the right state. If a district stays gray on the map
// despite having a monitored site, add its exact boundary-source spelling
// here (open the browser console - a dev-mode warning logs any monitored
// site whose district didn't match a polygon).
const DISTRICT_ALIASES: Record<string, string> = {
  'bangalore|karnataka': 'Bengaluru Urban',
  'bangalore urban|karnataka': 'Bengaluru Urban',
  'bengaluru|karnataka': 'Bengaluru Urban',
  'mysore|karnataka': 'Mysuru',
  'mumbai|maharashtra': 'Mumbai Suburban',
  'mumbai city|maharashtra': 'Mumbai Suburban',
  'bombay|maharashtra': 'Mumbai Suburban',
  'delhi|delhi': 'New Delhi',
  'central delhi|delhi': 'New Delhi',
  'new delhi|delhi': 'New Delhi',
  'north|delhi': 'North Delhi',
  'south|delhi': 'South Delhi',
  'gurgaon|haryana': 'Gurugram',
  'kamrup|assam': 'Kamrup Metropolitan',
  'kamrup metropolitan|assam': 'Kamrup Metropolitan',
  'madras|tamil nadu': 'Chennai',
  'purbi singhbhum|jharkhand': 'East Singhbhum',
  'ahmadabad|gujarat': 'Ahmedabad',
  'hardwar|uttarakhand': 'Haridwar',
  'haora|west bengal': 'Howrah',
  // Confirmed 2026-09-22 directly from the user's own indus_locations rows
  // (e.g. id 21991/21998, circle "J&K", district column literally "Leh
  // Ladakh") - the real table does NOT spell this "Leh" alone (the generic
  // parenthetical-stripping fallback below would have produced that, which
  // is close but wrong) and does NOT carry the boundary source's own
  // "Leh (ladakh)" spelling either. This exact alias is what makes a map
  // click's exact-match district REST filter actually find these rows.
  'leh ladakh|ladakh': 'Leh Ladakh',
  // Confirmed 2026-09-28 ("Ramban, Poonch, Sheohar show no data/no coloring"
  // follow-up): a temporary diagnostic (see LiveMapPage.tsx's own history)
  // showed Poonch's known-good tower (id 19010, real live observation,
  // correctly counted in the risk index with siteCount > 0 - genuinely
  // monitored) geo-resolving to "Punch" - jammu-and-kashmir.json's own
  // district property really is spelled "Punch" (confirmed by reading the
  // shipped boundary file directly), not "Poonch" as this app's own
  // indus_locations.District column and district dropdown spell it. With no
  // alias, the risk index keyed this tower's contribution under "punch"
  // while `selectedDistrict` (set from the dropdown/site data's own
  // "Poonch") never matched it - so the shape drew and colored correctly,
  // just silently under a different internal name than the one the user
  // was looking for, with no selection highlight/zoom-to-fit either. This
  // did NOT show up as a console warning (that check only runs in
  // DistrictLayer, the real-boundary view - not DistrictHullLayer, the
  // Indus/Towers hull view where this was actually observed).
  'punch|jammu and kashmir': 'Poonch',
  // Same alias gap, different district - caught directly from the existing
  // dev-mode console warning this app already ships
  // (`[DistrictLayer] "Bandipora" has N monitored site(s) but didn't match
  // any polygon in Jammu Kashmir's boundary file`), while investigating the
  // Poonch/Ramban/Sheohar report above. The boundary file spells this
  // district "Bandipore"; this app's own site data and dropdown spell it
  // "Bandipora".
  'bandipore|jammu and kashmir': 'Bandipora',
  // Confirmed 2026-09-30 ("in live-map... some district have show grey
  // colors") from a user-run `SELECT DISTINCT State, District FROM
  // indus_locations`: four Madhya Pradesh & Chhattisgarh districts are
  // stored under their MODERN official name, but this 2011-Census-era
  // boundary source (see this file's header) still carries the OLD
  // pre-rename name as its own `district` property - a real, documented
  // administrative rename in each case, not a guess:
  //  - Hoshangabad district was officially renamed Narmadapuram in 2021.
  //  - East Nimar district was officially renamed Khandwa in 1998 (the real
  //    table's own rows use both "Khandwa" and "Khandwa (East Nimar)").
  //  - West Nimar district was officially renamed Khargone in 1998 (rows use
  //    both "Khargone" and "Khargone (West Nimar)").
  //  - Chhattisgarh's Koriya district is the boundary source's own spelling;
  //    the real table spells this same district "Korea" (both are standard
  //    English transliterations of the same Hindi district name).
  // Without these, geography-based resolution still generally works for a
  // tower whose real coordinates land inside the (correctly-shaped, just
  // old-named) polygon - but the resolved name shown everywhere (hover
  // tooltips, the district panel title, `selectedDistrict` matching) would
  // be the stale Census-era name, and any tower whose point-in-polygon test
  // fails and falls back to its own stored `district` field (which uses the
  // MODERN name) would fail to match at all.
  'hoshangabad|madhya pradesh': 'Narmadapuram',
  'east nimar|madhya pradesh': 'Khandwa',
  'west nimar|madhya pradesh': 'Khargone',
  'koriya|chhattisgarh': 'Korea',
};

// Selection-matching aliases - the OPPOSITE direction from DISTRICT_ALIASES
// above (which remaps a BOUNDARY FILE spelling to this app's canonical
// spelling). These resolve a raw label that can appear as the
// `selectedDistrict` value - picked from the State/District dropdown, which
// as of Follow-up fix #16 (see claude/live-map-indus-district-hull-
// replacement.md) sources from the curated `indus_districts` reference
// table - to whichever REAL polygon it should be treated as equivalent to,
// purely so DistrictLayer (the plain, real-government-boundary Live Map
// view) can find/highlight/zoom to the right shape. `indus_districts` is
// known to carry near-duplicate internal spellings for the same real place
// (flagged, unresolved, when that table was first wired into the dropdown -
// e.g. "Bilaspur"/"Bilaspur(MPCG)") that were never meant to be distinct
// administrative districts - only ONE of them ever has a real boundary
// polygon. This table does NOT affect DistrictHullLayer (the Indus/Towers
// view), which matches off each tower's own raw `District` field directly
// and correctly keeps treating a duplicate label as its own group - only
// the plain view's selection-matching needed this.
//
// Confirmed 2026-09-29 ("in live-map without click indus they not
// redirect... in indus click then redirect"): picking "Bilaspur(MPCG)" from
// the dropdown never matched any polygon, because the shipped Chhattisgarh
// boundary file only has a plain "Bilaspur" feature - real towers recorded
// under "Bilaspur(MPCG)" are geographically the same real Chhattisgarh
// district, just an alternate internal label, not a separate place.
//
// Keyed by `${normalizedSelectedValue}|${normalizedRealState}` (the real
// state, e.g. "Chhattisgarh" - NOT the raw circle name like "Madhya Pradesh
// & Chhattisgarh", since a combined circle's two real states are fetched
// and matched as separate boundary files - see
// useDistrictBoundaries.ts/districtMatchesSelection's own callers for how
// each feature's own real state is resolved). Value is the normalized
// target polygon name to treat the selection as equivalent to.
const SELECTION_DISTRICT_ALIASES: Record<string, string> = {
  'bilaspur mpcg|chhattisgarh': 'bilaspur',
};

/**
 * True if a polygon feature (its canonical `rawName` and its own real
 * `realState`, both as extracted/canonicalized from the boundary file) is
 * the one the user picked (`selectedDistrict`, straight from the dropdown or
 * a map click) - either an exact normalized match, or a known selection-
 * alias match (SELECTION_DISTRICT_ALIASES above, for a raw DB/dropdown label
 * with no real polygon of its own, like "Bilaspur(MPCG)"). Replaces this
 * file's old same-file-local `sameDistrict()` helpers in DistrictLayer.tsx,
 * which only ever did the plain normalizeName comparison and had no way to
 * resolve a duplicate-spelling dropdown entry to the one real polygon that
 * actually represents it.
 */
export function districtMatchesSelection(
  rawName: string | null | undefined,
  realState: string | null | undefined,
  selectedDistrict: string | null | undefined
): boolean {
  if (!rawName || !selectedDistrict) return false;
  if (normalizeName(rawName) === normalizeName(selectedDistrict)) return true;
  if (!realState) return false;
  const key = `${normalizeName(selectedDistrict)}|${normalizeName(realState)}`;
  return SELECTION_DISTRICT_ALIASES[key] === normalizeName(rawName);
}

export function canonicalDistrictName(rawDistrict: string, rawState: string): string {
  const key = `${normalizeName(rawDistrict)}|${normalizeName(rawState)}`;
  const alias = DISTRICT_ALIASES[key];
  if (alias) return alias;
  // Fallback for a boundary-source district name carrying a disambiguating
  // parenthetical suffix - found 2026-09-22 while wiring in Ladakh's
  // district boundaries: the source spells one of its two districts
  // "Leh (ladakh)" (added, per generate_boundaries.py, purely to disambiguate
  // this Leh from any other "Leh"-named feature once Ladakh's districts were
  // split out of the former undivided Jammu and Kashmir - not part of the
  // district's actual name). Real site/tower records have no reason to carry
  // that qualifier, so comparing against it verbatim doesn't just leave the
  // polygon gray - since this same canonical value is also sent to the
  // backend as the exact-match `district` REST filter the instant that
  // polygon is clicked (see DistrictLayer.tsx's onSelectDistrict wiring), a
  // mismatch here silently returns ZERO towers for a district that may well
  // have real monitored sites. Stripping a trailing " (...)" is a general
  // fix rather than a one-off alias for this one district, in case another
  // state's file carries the same kind of disambiguating suffix.
  const stripped = rawDistrict.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return stripped || rawDistrict;
}

const stateCache = new Map<string, Promise<DistrictFeatureCollection>>();
// Resolved-value side cache, added 2026-09-30 alongside getCachedStateDistricts
// below - see that function's own doc comment for why this exists separately
// from `stateCache` (a Promise gives no synchronous way to ask "is this
// already done?").
const resolvedStateCache = new Map<string, DistrictFeatureCollection>();

/** Fetches (and memoizes for the lifetime of the tab) one state's district
 *  boundary FeatureCollection from this app's own static asset. */
export function fetchStateDistricts(stateName: string): Promise<DistrictFeatureCollection> {
  const cacheKey = normalizeName(stateName);
  const cached = stateCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    const res = await fetch(districtGeoJsonUrl(stateName));
    if (!res.ok) throw new Error(`HTTP ${res.status} loading district boundaries for ${stateName}`);
    const data = (await res.json()) as DistrictFeatureCollection;
    if (!data?.features?.length) throw new Error(`No district boundaries returned for ${stateName}`);
    resolvedStateCache.set(cacheKey, data);
    return data;
  })();

  stateCache.set(cacheKey, promise);
  // Don't cache a rejected promise - let the next caller retry.
  promise.catch(() => stateCache.delete(cacheKey));

  return promise;
}

/**
 * Synchronous peek at `fetchStateDistricts`'s own cache - returns the
 * already-resolved FeatureCollection for a state if it finished loading
 * earlier in this tab's lifetime, or `undefined` if it hasn't (yet, or at
 * all). Added 2026-09-30 per a real report that the "Loading district
 * boundaries..." popup looked "fake": `useDistrictBoundariesForStates` used
 * to set `loading: true` unconditionally the first time it saw a state name,
 * even when that state's file was ALREADY sitting in `stateCache` from
 * earlier in the same tab (e.g. leaving the Live Map page and coming back,
 * which remounts the component and resets its own `requested` ref, but does
 * NOT clear this module-level cache). The actual network fetch in that case
 * is instant/nonexistent, but the full-screen popup still flashed on -
 * exactly what "shows loading when nothing is really loading" means. This
 * lets the hook check first and skip the loading state entirely on a cache
 * hit, so the popup now only ever appears for a genuine, still-in-flight
 * fetch.
 */
export function getCachedStateDistricts(stateName: string): DistrictFeatureCollection | undefined {
  return resolvedStateCache.get(normalizeName(stateName));
}

let indiaStatesPromise: Promise<DistrictFeatureCollection> | null = null;
// See `resolvedStateCache`'s own comment above - same reasoning, same fix,
// for the single all-India state-outline fetch.
let resolvedIndiaStates: DistrictFeatureCollection | null = null;

/** Fetches (and memoizes for the lifetime of the tab) the all-India state
 *  boundary FeatureCollection - the Live Map's default view before any
 *  state is picked. */
export function fetchIndiaStates(): Promise<DistrictFeatureCollection> {
  if (indiaStatesPromise) return indiaStatesPromise;

  indiaStatesPromise = (async () => {
    const res = await fetch(INDIA_STATES_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} loading India state boundaries`);
    const data = (await res.json()) as DistrictFeatureCollection;
    if (!data?.features?.length) throw new Error('No state boundaries returned');
    resolvedIndiaStates = data;
    return data;
  })();

  indiaStatesPromise.catch(() => {
    indiaStatesPromise = null;
  });

  return indiaStatesPromise;
}

/** Synchronous peek at `fetchIndiaStates`'s own cache - see
 *  `getCachedStateDistricts`'s doc comment for why this exists (same fix,
 *  same reasoning, for the single all-India state-outline fetch instead of
 *  the per-state district fetch). */
export function getCachedIndiaStates(): DistrictFeatureCollection | undefined {
  return resolvedIndiaStates ?? undefined;
}
