import { apiSlice } from '@/api/apiSlice';
import { restRequest, isMockMode, currentMockUser } from '@/api/queryHelpers';
import { mockResponse } from '@/api/mock/db';
import { buildDashboardStats } from '@/api/mock/data/dashboard';
import type { DashboardStats } from './types';

/**
 * REST contract:
 *   GET /dashboard/stats -> DashboardStats
 */
export const dashboardApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardStats: builder.query<DashboardStats, void>({
      queryFn: async (_arg, api) => {
        if (isMockMode) {
          const data = await mockResponse(buildDashboardStats(currentMockUser(api)));
          return { data };
        }
        return restRequest<DashboardStats>({ url: '/dashboard/stats' });
      },
      providesTags: [{ type: 'Dashboard', id: 'STATS' }],
    }),
  }),
});

export const { useGetDashboardStatsQuery } = dashboardApi;
