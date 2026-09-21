import { apiSlice } from '@/api/apiSlice';
import { restRequest, isMockMode } from '@/api/queryHelpers';
import { mockResponse } from '@/api/mock/db';
import { buildComparisonRows } from '@/pages/comparison/comparisonData';
import type { ComparisonRow } from '@/pages/comparison/comparisonData';
import type { Site } from '@/features/sites/types';

export interface ComparisonQueryArgs {
  sites: Site[];
  days: number;
}

/**
 * REST contract: GET /comparison?siteIds=&days=
 *
 * The real backend joins the user's own `hourly_weather` (forecast) and
 * `actual_hourly_weather` (ground truth) MySQL tables per site/day - see
 * ComparisonService/IndusComparisonService on the backend. Mock mode has no
 * equivalent archived-forecast table to join against, so it keeps the
 * seeded pseudo-forecast generator instead (see comparisonData.ts's own doc
 * comment on buildComparisonRows) rather than calling the real endpoint.
 */
export const comparisonApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getComparison: builder.query<ComparisonRow[], ComparisonQueryArgs>({
      queryFn: async ({ sites, days }) => {
        if (isMockMode) {
          const data = await mockResponse(buildComparisonRows(sites, days));
          return { data };
        }
        if (sites.length === 0) {
          return { data: [] };
        }
        const siteIds = sites.map((s) => s.id).join(',');
        return restRequest<ComparisonRow[]>({ url: '/comparison', params: { siteIds, days } });
      },
    }),
  }),
});

export const { useGetComparisonQuery } = comparisonApi;
