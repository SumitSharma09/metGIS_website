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
 * NOTE: the state-level file still shows "Jammu and Kashmir" as a single
 * outline - the Survey of India state-level index map predates the 2019
 * split and there is no separate Ladakh polygon at the state level in this
 * source, only at the district level (where the split above was applied).
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
};

export function canonicalDistrictName(rawDistrict: string, rawState: string): string {
  const key = `${normalizeName(rawDistrict)}|${normalizeName(rawState)}`;
  return DISTRICT_ALIASES[key] ?? rawDistrict;
}

const stateCache = new Map<string, Promise<DistrictFeatureCollection>>();

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
    return data;
  })();

  stateCache.set(cacheKey, promise);
  // Don't cache a rejected promise - let the next caller retry.
  promise.catch(() => stateCache.delete(cacheKey));

  return promise;
}

let indiaStatesPromise: Promise<DistrictFeatureCollection> | null = null;

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
    return data;
  })();

  indiaStatesPromise.catch(() => {
    indiaStatesPromise = null;
  });

  return indiaStatesPromise;
}
