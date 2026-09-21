import type { UserProfile } from '@/features/users/types';
import type { Site } from '@/features/sites/types';

/**
 * Mock-mode mirror of the backend's `AccessScope` (RBAC by state/circle/
 * district, scope doc section 5). The real Spring Boot backend enforces
 * this server-side (see backend/.../security/AccessScope.java); this file
 * gives the mock data layer (src/api/mock/**, the default mode this app
 * runs in - see VITE_USE_MOCK_API) the same behavior so the RBAC feature
 * is visible without a live backend.
 *
 * An 'admin' is always Pan-India. An 'operator'/'viewer' only sees sites
 * (and anything derived from sites - weather, alerts, reports, dashboard
 * stats, search) within their `assignedStates`.
 */

export function isPanIndia(user: UserProfile | null | undefined): boolean {
  return !user || user.role === 'admin';
}

export function canAccessState(user: UserProfile | null | undefined, state: string | null | undefined): boolean {
  if (!state || isPanIndia(user)) return true;
  return (user!.assignedStates ?? []).some((s) => s.toLowerCase() === state.toLowerCase());
}

export function restrictStates(user: UserProfile | null | undefined, states: string[]): string[] {
  if (isPanIndia(user)) return states;
  return states.filter((s) => canAccessState(user, s));
}

export function restrictSites<T extends Pick<Site, 'state'>>(user: UserProfile | null | undefined, sites: T[]): T[] {
  if (isPanIndia(user)) return sites;
  return sites.filter((s) => canAccessState(user, s.state));
}

/**
 * The set of site IDs a user may see, given the full site list - the
 * building block for scoping alerts/reports/search/dashboard results,
 * which reference sites by ID rather than carrying a `state` field
 * themselves.
 */
export function inScopeSiteIdSet<T extends Pick<Site, 'id' | 'state'>>(
  user: UserProfile | null | undefined,
  allSites: T[]
): Set<string> {
  return new Set(restrictSites(user, allSites).map((s) => s.id));
}
