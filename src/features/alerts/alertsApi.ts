import { apiSlice } from '@/api/apiSlice';
import { restRequest, isMockMode, currentMockUser } from '@/api/queryHelpers';
import { mockResponse, paginate, textSearch } from '@/api/mock/db';
import { alerts } from '@/api/mock/data/alerts';
import { sites } from '@/api/mock/data/sites';
import { inScopeSiteIdSet } from '@/utils/accessScope';
import type { PaginatedResult } from '@/types/common';
import type { AlertItem, AlertListQuery, AlertStatus } from './types';

/**
 * REST contract:
 *   GET   /alerts?search=&severity=&status=&siteId=&page=&pageSize=
 *   GET   /alerts/:id
 *   PATCH /alerts/:id/read           -> AlertItem
 *   PATCH /alerts/:id/status  {status} -> AlertItem
 *   GET   /alerts/unread-count       -> { count }
 */
export const alertsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listAlerts: builder.query<PaginatedResult<AlertItem>, AlertListQuery | void>({
      queryFn: async (query, api) => {
        const q = query ?? {};
        if (isMockMode) {
          const inScope = inScopeSiteIdSet(currentMockUser(api), sites);
          let filtered = alerts.filter((a) => inScope.has(a.siteId));
          if (q.severity) filtered = filtered.filter((a) => a.severity === q.severity);
          if (q.status) filtered = filtered.filter((a) => a.status === q.status);
          if (q.siteId) filtered = filtered.filter((a) => a.siteId === q.siteId);
          filtered = textSearch(filtered, q.search, ['siteName', 'message', 'parameter']);
          const data = await mockResponse(paginate(filtered, { page: q.page, pageSize: q.pageSize }));
          return { data };
        }
        return restRequest<PaginatedResult<AlertItem>>({ url: '/alerts', params: q });
      },
      providesTags: (result) =>
        result
          ? [...result.items.map((a) => ({ type: 'Alert' as const, id: a.id })), { type: 'Alert', id: 'LIST' }]
          : [{ type: 'Alert', id: 'LIST' }],
    }),
    getAlertById: builder.query<AlertItem, string>({
      queryFn: async (id, api) => {
        if (isMockMode) {
          const alert = alerts.find((a) => a.id === id);
          const inScope = inScopeSiteIdSet(currentMockUser(api), sites);
          if (!alert || !inScope.has(alert.siteId)) {
            return { error: { status: 404, message: 'Alert not found' } };
          }
          const data = await mockResponse(alert);
          return { data };
        }
        return restRequest<AlertItem>({ url: `/alerts/${id}` });
      },
      providesTags: (_result, _error, id) => [{ type: 'Alert', id }],
    }),
    markAlertRead: builder.mutation<AlertItem, string>({
      queryFn: async (id, api) => {
        if (isMockMode) {
          const alert = alerts.find((a) => a.id === id);
          const inScope = inScopeSiteIdSet(currentMockUser(api), sites);
          if (!alert || !inScope.has(alert.siteId)) {
            return { error: { status: 404, message: 'Alert not found' } };
          }
          alert.read = true;
          const data = await mockResponse(alert);
          return { data };
        }
        return restRequest<AlertItem>({ url: `/alerts/${id}/read`, method: 'PATCH' });
      },
      invalidatesTags: (_result, _error, id) => [
        { type: 'Alert', id },
        { type: 'Alert', id: 'LIST' },
        { type: 'Alert', id: 'UNREAD_COUNT' },
      ],
    }),
    updateAlertStatus: builder.mutation<AlertItem, { id: string; status: AlertStatus }>({
      queryFn: async ({ id, status }, api) => {
        if (isMockMode) {
          const alert = alerts.find((a) => a.id === id);
          const inScope = inScopeSiteIdSet(currentMockUser(api), sites);
          if (!alert || !inScope.has(alert.siteId)) {
            return { error: { status: 404, message: 'Alert not found' } };
          }
          alert.status = status;
          if (status !== 'active') alert.read = true;
          const data = await mockResponse(alert);
          return { data };
        }
        return restRequest<AlertItem>({ url: `/alerts/${id}/status`, method: 'PATCH', data: { status } });
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Alert', id },
        { type: 'Alert', id: 'LIST' },
        { type: 'Alert', id: 'UNREAD_COUNT' },
      ],
    }),
    getUnreadAlertCount: builder.query<{ count: number }, void>({
      queryFn: async (_arg, api) => {
        if (isMockMode) {
          const inScope = inScopeSiteIdSet(currentMockUser(api), sites);
          const count = alerts.filter((a) => !a.read && inScope.has(a.siteId)).length;
          const data = await mockResponse({ count });
          return { data };
        }
        return restRequest<{ count: number }>({ url: '/alerts/unread-count' });
      },
      providesTags: [{ type: 'Alert', id: 'UNREAD_COUNT' }],
    }),
  }),
});

export const {
  useListAlertsQuery,
  useGetAlertByIdQuery,
  useMarkAlertReadMutation,
  useUpdateAlertStatusMutation,
  useGetUnreadAlertCountQuery,
} = alertsApi;
