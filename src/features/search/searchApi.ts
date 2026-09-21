import { apiSlice } from '@/api/apiSlice';
import { restRequest, isMockMode, currentMockUser } from '@/api/queryHelpers';
import { mockResponse } from '@/api/mock/db';
import { sites } from '@/api/mock/data/sites';
import { alerts } from '@/api/mock/data/alerts';
import { reports } from '@/api/mock/data/reports';
import { inScopeSiteIdSet } from '@/utils/accessScope';
import type { GlobalSearchResult } from './types';

/**
 * REST contract:
 *   GET /search?q=term -> GlobalSearchResult (grouped, top matches per type)
 */
export const searchApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    globalSearch: builder.query<GlobalSearchResult, string>({
      queryFn: async (term, api) => {
        const q = term.trim().toLowerCase();
        if (!q) {
          return { data: { sites: [], alerts: [], reports: [] } };
        }
        if (isMockMode) {
          // RBAC: search must never surface a site, alert or report outside
          // the caller's assigned states.
          const inScope = inScopeSiteIdSet(currentMockUser(api), sites);
          const matchedSites = sites
            .filter((s) => inScope.has(s.id))
            .filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))
            .slice(0, 5)
            .map((s) => ({ id: s.id, label: s.name, sublabel: `${s.code} · ${s.circle}` }));
          const matchedAlerts = alerts
            .filter((a) => inScope.has(a.siteId))
            .filter((a) => a.message.toLowerCase().includes(q) || a.siteName.toLowerCase().includes(q))
            .slice(0, 5)
            .map((a) => ({ id: a.id, label: a.message, sublabel: `${a.severity} · ${a.siteName}` }));
          const matchedReports = reports
            .filter((r) => r.siteIds.some((id) => inScope.has(id)))
            .filter((r) => r.title.toLowerCase().includes(q))
            .slice(0, 5)
            .map((r) => ({ id: r.id, label: r.title, sublabel: `${r.format.toUpperCase()} · ${r.status}` }));
          const data = await mockResponse({ sites: matchedSites, alerts: matchedAlerts, reports: matchedReports }, 250);
          return { data };
        }
        return restRequest<GlobalSearchResult>({ url: '/search', params: { q: term } });
      },
    }),
  }),
});

export const { useLazyGlobalSearchQuery } = searchApi;
