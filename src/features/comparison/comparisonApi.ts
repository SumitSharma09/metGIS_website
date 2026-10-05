import { apiSlice } from '@/api/apiSlice';
import { restRequest, isMockMode, currentMockUser } from '@/api/queryHelpers';
import { mockResponse } from '@/api/mock/db';
import { sites } from '@/api/mock/data/sites';
import { restrictSites } from '@/utils/accessScope';
import { buildComparisonRows } from '@/pages/comparison/comparisonData';
import type { ComparisonRow, DistrictSeed } from '@/pages/comparison/comparisonData';

export interface DistrictComparisonQueryArgs {
  state?: string;
  district?: string;
  days: number;
}

/**
 * REST contract: GET /comparison/districts?state=&district=&days=
 *
 * District-level successor to the old per-site `GET /comparison` endpoint -
 * the real backend now joins the user's own `indus_districts_actual_gtsData`
 * (ground truth) and `skymet_save_forecast_data` (same-day forecast archive,
 * `day_sequence=0`) MySQL tables per district/day, RBAC-scoped the same way
 * every other site-derived list is (see ComparisonService/
 * IndusDistrictComparisonService on the backend). `state`/`district` are
 * both optional filters - omit either (or both) for every district in the
 * caller's scope.
 * <p>
 * Mock mode has no equivalent archived-forecast table to join against, so it
 * keeps the seeded pseudo-forecast generator instead (see
 * comparisonData.ts's own doc comment on buildComparisonRows) rather than
 * calling the real endpoint - one representative site per matching district
 * seeds that generator, RBAC-restricted through the same `restrictSites`
 * every other mock endpoint in this app uses.
 */
export const comparisonApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDistrictComparison: builder.query<ComparisonRow[], DistrictComparisonQueryArgs>({
      queryFn: async ({ state, district, days }, api) => {
        if (isMockMode) {
          const user = currentMockUser(api);
          let scoped = restrictSites(user, sites);
          if (state) scoped = scoped.filter((s) => s.state === state);
          if (district) scoped = scoped.filter((s) => s.district === district);

          const byDistrict = new Map<string, DistrictSeed>();
          scoped.forEach((s) => {
            if (!byDistrict.has(s.district)) {
              byDistrict.set(s.district, { siteId: s.id, district: s.district, state: s.state });
            }
          });

          const data = await mockResponse(buildComparisonRows([...byDistrict.values()], days));
          return { data };
        }
        return restRequest<ComparisonRow[]>({ url: '/comparison/districts', params: { state, district, days } });
      },
    }),
  }),
});

export const { useGetDistrictComparisonQuery } = comparisonApi;
