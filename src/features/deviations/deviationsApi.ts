import { apiSlice } from '@/api/apiSlice';
import { restRequest, isMockMode, currentMockUser } from '@/api/queryHelpers';
import { mockResponse, paginate } from '@/api/mock/db';
import { deviationAlerts, runDeviationCycle, acknowledgeDeviation } from '@/api/mock/data/deviations';
import { sites } from '@/api/mock/data/sites';
import { inScopeSiteIdSet } from '@/utils/accessScope';
import type { PaginatedResult } from '@/types/common';
import type { DeviationAlert, DeviationListQuery } from './types';

/**
 * REST contract (scope doc section 2, Deviation Alert Mechanism):
 *   GET   /deviations?siteId=&severity=&page=&pageSize=  -> PaginatedResult<DeviationAlert>
 *   POST  /deviations/run                                 -> DeviationAlert[] (newly detected)
 *   PATCH /deviations/:id/acknowledge                      -> DeviationAlert
 */
export const deviationsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listDeviations: builder.query<PaginatedResult<DeviationAlert>, DeviationListQuery | void>({
      queryFn: async (query, api) => {
        const q = query ?? {};
        if (isMockMode) {
          const inScope = inScopeSiteIdSet(currentMockUser(api), sites);
          let filtered = deviationAlerts.filter((d) => inScope.has(d.siteId));
          if (q.siteId) filtered = filtered.filter((d) => d.siteId === q.siteId);
          if (q.severity) filtered = filtered.filter((d) => d.severity === q.severity);
          filtered = [...filtered].sort((a, b) => (a.detectedAt < b.detectedAt ? 1 : -1));
          const data = await mockResponse(paginate(filtered, { page: q.page, pageSize: q.pageSize }));
          return { data };
        }
        return restRequest<PaginatedResult<DeviationAlert>>({ url: '/deviations', params: q });
      },
      providesTags: (result) =>
        result
          ? [...result.items.map((d) => ({ type: 'Deviation' as const, id: d.id })), { type: 'Deviation', id: 'LIST' }]
          : [{ type: 'Deviation', id: 'LIST' }],
    }),
    runDeviationCheck: builder.mutation<DeviationAlert[], void>({
      queryFn: async () => {
        if (isMockMode) {
          const data = await mockResponse(runDeviationCycle(), 600);
          return { data };
        }
        return restRequest<DeviationAlert[]>({ url: '/deviations/run', method: 'POST' });
      },
      invalidatesTags: [{ type: 'Deviation', id: 'LIST' }],
    }),
    acknowledgeDeviation: builder.mutation<DeviationAlert, string>({
      queryFn: async (id, api) => {
        if (isMockMode) {
          const inScope = inScopeSiteIdSet(currentMockUser(api), sites);
          const alert = deviationAlerts.find((d) => d.id === id);
          if (!alert || !inScope.has(alert.siteId)) {
            return { error: { status: 404, message: 'Deviation alert not found' } };
          }
          const updated = acknowledgeDeviation(id)!;
          const data = await mockResponse(updated);
          return { data };
        }
        return restRequest<DeviationAlert>({ url: `/deviations/${id}/acknowledge`, method: 'PATCH' });
      },
      invalidatesTags: (_result, _error, id) => [
        { type: 'Deviation', id },
        { type: 'Deviation', id: 'LIST' },
      ],
    }),
  }),
});

export const { useListDeviationsQuery, useRunDeviationCheckMutation, useAcknowledgeDeviationMutation } = deviationsApi;
