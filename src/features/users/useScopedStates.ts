import { useAppSelector } from '@/app/hooks';
import { useListStatesQuery } from '@/features/sites/sitesApi';
import { isPanIndia } from '@/utils/accessScope';

/**
 * The states the signed-in user is allowed to see (RBAC by state/circle/
 * district, scope doc section 5), plus a couple of flags UI components use
 * to explain *why* a dropdown is narrowed.
 *
 * `useListStatesQuery()` already returns a pre-scoped list in mock mode
 * (see sitesApi.ts's `listStates`, which filters through
 * `src/utils/accessScope.ts`) and the real backend scopes the same
 * endpoint server-side, so most state dropdowns (Live Map, Reports,
 * Comparison) don't need anything beyond calling that query directly.
 * Use this hook instead where a component also wants to know whether the
 * current user is scoped at all - e.g. to show a "Scoped to: Delhi,
 * Haryana" badge, or to hide a "Pan-India" toggle for non-admins.
 */
export function useScopedStates() {
  const user = useAppSelector((state) => state.auth.user);
  const { data: states = [], isLoading } = useListStatesQuery();

  return {
    states,
    isLoading,
    isPanIndia: isPanIndia(user),
    assignedStates: user?.assignedStates ?? [],
  };
}
