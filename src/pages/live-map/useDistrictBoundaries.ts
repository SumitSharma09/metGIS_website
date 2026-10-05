import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchStateDistricts,
  fetchIndiaStates,
  getCachedStateDistricts,
  getCachedIndiaStates,
  extractStateName,
  type DistrictFeature,
} from './districtGeo';
import { normalizeName, splitCircleStateName } from '@/utils/districtRisk';
import { useScopedStates } from '@/features/users/useScopedStates';
import { useListStatesQuery } from '@/features/sites/sitesApi';

interface StateBoundaryStatus {
  features: DistrictFeature[];
  loading: boolean;
  error: boolean;
}

const EMPTY_STATUS: StateBoundaryStatus = { features: [], loading: false, error: false };

/**
 * Loads district-boundary polygons for a set of states, one small
 * per-state file each (cached in `districtGeo.ts` for the tab's lifetime),
 * fetched in parallel. Used two ways by the Live Map:
 *  - no state picked yet -> pass every state that has a monitored site, so
 *    the whole country shows colored districts on first load (matching the
 *    reference product's default view);
 *  - a state picked -> pass just that one state, for the zoomed-in view.
 *
 * Implemented as one hook tracking a dynamic list (rather than one
 * `useDistrictBoundaries(stateName)` call per state) so the number of
 * states being watched can change from render to render without breaking
 * the rules of hooks.
 */
export function useDistrictBoundariesForStates(stateNames: string[]) {
  const [statusByState, setStatusByState] = useState<Record<string, StateBoundaryStatus>>({});
  const requested = useRef<Set<string>>(new Set());
  const key = [...stateNames].sort().join('|');

  useEffect(() => {
    stateNames.forEach((name) => {
      if (requested.current.has(name)) return;
      requested.current.add(name);

      // Cache check added 2026-09-30, per a real report that the "Loading
      // district boundaries..." popup looked "fake" - see
      // getCachedStateDistricts's own doc comment for the full story. A
      // remount of this hook (e.g. leaving Live Map and coming back) starts
      // `requested` over from empty, but districtGeo.ts's own module-level
      // cache survives across that remount for the tab's whole lifetime. Go
      // straight to the resolved state when the data is already there
      // instead of flashing `loading: true` for a fetch that both isn't
      // needed and never happens.
      const cached = getCachedStateDistricts(name);
      if (cached) {
        setStatusByState((prev) => ({ ...prev, [name]: { features: cached.features, loading: false, error: false } }));
        return;
      }

      setStatusByState((prev) => ({ ...prev, [name]: { features: [], loading: true, error: false } }));
      fetchStateDistricts(name)
        .then((collection) => {
          setStatusByState((prev) => ({ ...prev, [name]: { features: collection.features, loading: false, error: false } }));
        })
        .catch(() => {
          requested.current.delete(name); // allow a retry if this state is requested again later
          setStatusByState((prev) => ({ ...prev, [name]: { features: [], loading: false, error: true } }));
        });
    });
    // `key` (the sorted, joined state list) is the real dependency - it only
    // changes when the actual set of requested states changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return {
    get: (stateName: string): StateBoundaryStatus => statusByState[stateName] ?? EMPTY_STATUS,
  };
}

interface IndiaStatesStatus {
  features: DistrictFeature[];
  loading: boolean;
  error: boolean;
}

/**
 * Loads the all-India state-boundary FeatureCollection once (memoized in
 * `districtGeo.ts` for the tab's lifetime) - the Live Map's default view,
 * shown before any state is picked. Kept separate from
 * `useDistrictBoundariesForStates` above because it fetches one fixed
 * asset rather than a dynamic, per-state list.
 */
export function useIndiaStates(): IndiaStatesStatus {
  const [status, setStatus] = useState<IndiaStatesStatus>({ features: [], loading: true, error: false });
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;

    // Same cache-check fix as useDistrictBoundariesForStates above (2026-09-30)
    // - a remount must not show "Loading state boundaries..." for the one
    // all-India outline file once it's already sitting in districtGeo.ts's
    // module-level cache from earlier in the tab.
    const cached = getCachedIndiaStates();
    if (cached) {
      setStatus({ features: cached.features, loading: false, error: false });
      return;
    }

    fetchIndiaStates()
      .then((collection) => setStatus({ features: collection.features, loading: false, error: false }))
      .catch(() => {
        requested.current = false; // allow a retry on next mount
        setStatus({ features: [], loading: false, error: true });
      });
  }, []);

  return status;
}

interface VisibleStates {
  /** Every state/circle this signed-in user should be able to PICK and
   *  FILTER by: the real, monitored list from `useListStatesQuery()`
   *  (`INDUS_CIRCLES.State` when Indus mode is on, the demo H2 states
   *  otherwise), intersected with RBAC (`useScopedStates()`). This is the
   *  source of truth for dropdowns - it does NOT require a matching
   *  boundary polygon (see `features` below for why that matters). */
  names: string[];
  /** Boundary polygons for the default nationwide outline layer - ONLY a
   *  best-effort SUBSET of `names`, wherever `india-states.json` happens to
   *  have a single matching government-state polygon. Several of this
   *  app's real `State` values are circle-style groupings spanning more
   *  than one government-recognized state (e.g. `INDUS_CIRCLES` has "Bihar
   *  & Jharkhand" and "Madhya Pradesh & Chhattisgarh" - two states each,
   *  under one circle name) and will never match a single polygon here.
   *  That's fine: a name in `names` but missing from `features` just isn't
   *  outlined/colored on the zoomed-out map - it's still fully selectable,
   *  and its towers still plot as plain markers via `SiteMarkers` (which
   *  only needs lat/long, not a boundary shape). */
  features: DistrictFeature[];
  loading: boolean;
  error: boolean;
}

/**
 * The single, shared source of "every state/circle this signed-in user
 * should see" - the real monitored-state list (`useListStatesQuery()`)
 * intersected with RBAC (`useScopedStates()`), plus a best-effort subset of
 * real government boundary polygons (`useIndiaStates()`) for whichever of
 * those happen to line up one-to-one with a real state.
 *
 * This used to require EVERY visible state to also have a matching
 * boundary polygon, which was itself a fix for an earlier bug (showing
 * states with zero monitored sites) but overcorrected into a new one: three
 * of this deployment's four real `INDUS_CIRCLES.State` values are
 * circle-style groupings of two government states each ("Bihar &
 * Jharkhand", "Madhya Pradesh & Chhattisgarh") or spelled differently than
 * the boundary file ("Jammu Kashmir" vs "Jammu and Kashmir") - none of
 * those match a single polygon, so requiring a match silently dropped them
 * from every dropdown even though they have real towers. `names` and
 * `features` are now independent: `names` (what dropdowns/filters use) is
 * never narrowed by boundary-matching, only by RBAC. Shared by
 * `FloodMap.tsx`, `RegionRiskMap.tsx`, and the Reports page's state filter
 * (`TowerRiskReportsTab.tsx`), so this fixes all four at once.
 */
export function useVisibleStates(): VisibleStates {
  const indiaStates = useIndiaStates();
  const { isPanIndia, assignedStates } = useScopedStates();
  const { data: monitoredStates = [], isLoading: statesLoading } = useListStatesQuery();

  const names = useMemo(() => {
    if (isPanIndia) return [...monitoredStates].sort();
    const allowed = new Set(assignedStates.map(normalizeName));
    return monitoredStates.filter((name) => allowed.has(normalizeName(name))).sort();
  }, [monitoredStates, isPanIndia, assignedStates]);

  const features = useMemo(() => {
    if (indiaStates.features.length === 0 || names.length === 0) return [];
    // `names` is this deployment's raw `Site.state` (circle) values, e.g.
    // "Bihar & Jharkhand" - which never matches a boundary-file polygon
    // directly (those are named after the real, single government state,
    // "Bihar" and "Jharkhand" separately). Expanding each circle name via
    // `splitCircleStateName` (the same helper buildStateRiskIndex uses to
    // color these polygons - see districtRisk.ts) is what lets BOTH real
    // states a combined circle spans actually get included here at all.
    // Without this, a combined/misspelled circle's polygon was silently
    // dropped from the map entirely - not colored gray, just never drawn -
    // which is what made most of the country appear to have no boundaries.
    const allowedNames = new Set(names.flatMap((name) => splitCircleStateName(name).map(normalizeName)));
    return indiaStates.features.filter((f) => {
      const name = extractStateName(f);
      return name ? allowedNames.has(normalizeName(name)) : false;
    });
  }, [indiaStates.features, names]);

  return { features, names, loading: indiaStates.loading || statesLoading, error: indiaStates.error };
}
