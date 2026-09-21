import dayjs from 'dayjs';
import { apiSlice } from '@/api/apiSlice';
import { restRequest, isMockMode, currentMockUser } from '@/api/queryHelpers';
import { mockResponse, paginate, textSearch } from '@/api/mock/db';
import { reports } from '@/api/mock/data/reports';
import { getSiteById, sites } from '@/api/mock/data/sites';
import { inScopeSiteIdSet } from '@/utils/accessScope';
import type { PaginatedResult } from '@/types/common';
import type { CreateReportPayload, ReportItem, ReportListQuery } from './types';

/**
 * REST contract:
 *   GET    /reports?search=&status=&page=&pageSize=
 *   POST   /reports          { title, siteIds, parameters, dateFrom, dateTo, format } -> ReportItem
 *   DELETE /reports/:id
 *   GET    /reports/:id/download   -> binary file stream
 */
export const reportsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listReports: builder.query<PaginatedResult<ReportItem>, ReportListQuery | void>({
      queryFn: async (query, api) => {
        const q = query ?? {};
        if (isMockMode) {
          const inScope = inScopeSiteIdSet(currentMockUser(api), sites);
          // RBAC: a report "belongs" to the states of the sites it covers -
          // hide it unless at least one of those sites is in scope.
          let filtered = reports.filter((r) => r.siteIds.some((id) => inScope.has(id)));
          if (q.status) filtered = filtered.filter((r) => r.status === q.status);
          filtered = textSearch(filtered, q.search, ['title', 'generatedBy']);
          const data = await mockResponse(paginate(filtered, { page: q.page, pageSize: q.pageSize }));
          return { data };
        }
        return restRequest<PaginatedResult<ReportItem>>({ url: '/reports', params: q });
      },
      providesTags: (result) =>
        result
          ? [...result.items.map((r) => ({ type: 'Report' as const, id: r.id })), { type: 'Report', id: 'LIST' }]
          : [{ type: 'Report', id: 'LIST' }],
    }),
    createReport: builder.mutation<ReportItem, CreateReportPayload>({
      queryFn: async (payload, api) => {
        if (isMockMode) {
          const inScope = inScopeSiteIdSet(currentMockUser(api), sites);
          // RBAC: a non-admin can only build a report out of sites within
          // their assigned states, even if a stale UI selection somehow
          // includes an out-of-scope site id.
          const siteIds = payload.siteIds.filter((id) => inScope.has(id));
          if (siteIds.length === 0) {
            return { error: { status: 400, message: 'None of the requested sites are within your assigned states' } };
          }
          const newReport: ReportItem = {
            id: `report-${reports.length + 1}-${Date.now()}`,
            title: payload.title,
            siteIds,
            siteNames: siteIds.map((id) => getSiteById(id)?.name ?? id),
            parameters: payload.parameters,
            dateFrom: payload.dateFrom,
            dateTo: payload.dateTo,
            format: payload.format,
            status: 'processing',
            generatedBy: 'You',
            generatedAt: dayjs().toISOString(),
            fileSizeKb: 0,
          };
          reports.unshift(newReport);
          const data = await mockResponse(newReport, 700);
          // Simulate the report finishing generation shortly after creation.
          setTimeout(() => {
            newReport.status = 'ready';
            newReport.fileSizeKb = Math.round(200 + Math.random() * 3000);
          }, 2500);
          return { data };
        }
        return restRequest<ReportItem>({ url: '/reports', method: 'POST', data: payload });
      },
      invalidatesTags: [{ type: 'Report', id: 'LIST' }],
    }),
    deleteReport: builder.mutation<{ success: boolean }, string>({
      queryFn: async (id, api) => {
        if (isMockMode) {
          const index = reports.findIndex((r) => r.id === id);
          if (index === -1) return { error: { status: 404, message: 'Report not found' } };
          const inScope = inScopeSiteIdSet(currentMockUser(api), sites);
          if (!reports[index].siteIds.some((sid) => inScope.has(sid))) {
            return { error: { status: 404, message: 'Report not found' } };
          }
          reports.splice(index, 1);
          const data = await mockResponse({ success: true });
          return { data };
        }
        return restRequest<{ success: boolean }>({ url: `/reports/${id}`, method: 'DELETE' });
      },
      invalidatesTags: [{ type: 'Report', id: 'LIST' }],
    }),
  }),
});

export const { useListReportsQuery, useCreateReportMutation, useDeleteReportMutation } = reportsApi;
