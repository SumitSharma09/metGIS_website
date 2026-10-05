import { apiSlice } from '@/api/apiSlice';
import { restRequest, isMockMode, currentMockUser } from '@/api/queryHelpers';
import { mockResponse, paginate, sortItems, textSearch } from '@/api/mock/db';
import { sites, circles, states, districtsForState, tehsilsForDistrict, getSiteById } from '@/api/mock/data/sites';
import { canAccessState, isPanIndia, restrictSites, restrictStates } from '@/utils/accessScope';
import type { PaginatedResult } from '@/types/common';
import type { Site, SiteListQuery } from './types';

/**
 * REST contract:
 *   GET /sites?search=&circle=&state=&district=&status=&page=&pageSize=&sortBy=&sortDir=
 *   GET /sites/:id
 *   GET /sites/circles              (distinct list of circles/regions, for filter dropdowns)
 *   GET /sites/states               (distinct list of states, for the Live Map / Reports / Comparison drill-down)
 *   GET /sites/districts?state=     (distinct list of districts within a state - derived
 *                                    from real towers' own District field, see listDistricts)
 *   GET /sites/districts/reference?state=  (curated district list from the indus_districts
 *                                    reference table - see listDistrictsReference. Added
 *                                    2026-10-04 so the Live Map's dropdown can use a correct,
 *                                    disambiguated district list instead of whatever spelling
 *                                    happens to exist among real towers - see
 *                                    claude/live-map-indus-district-hull-replacement.md)
 *   GET /sites/tehsils?state=&district=   (distinct list of tehsils within a district)
 */
export const sitesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listSites: builder.query<PaginatedResult<Site>, SiteListQuery | void>({
      queryFn: async (query, api) => {
        const q = query ?? {};
        if (isMockMode) {
          const user = currentMockUser(api);
          let filtered = [...sites];
          // RBAC: a non-admin only ever sees sites in their assigned
          // states, mirroring the backend's SiteService.listSites - an
          // out-of-scope `state` filter just yields an empty page.
          filtered = restrictSites(user, filtered);
          if (q.circle) filtered = filtered.filter((s) => s.circle === q.circle);
          if (q.state) filtered = filtered.filter((s) => s.state === q.state);
          if (q.district) filtered = filtered.filter((s) => s.district === q.district);
          if (q.tehsil) filtered = filtered.filter((s) => s.tehsil === q.tehsil);
          if (q.status) filtered = filtered.filter((s) => s.status === q.status);
          filtered = textSearch(filtered, q.search, ['name', 'code', 'circle', 'state', 'district']);
          filtered = sortItems(filtered, { sortBy: q.sortBy, sortDir: q.sortDir });
          const data = await mockResponse(paginate(filtered, { page: q.page, pageSize: q.pageSize }));
          return { data };
        }
        return restRequest<PaginatedResult<Site>>({ url: '/sites', params: q });
      },
      providesTags: (result) =>
        result
          ? [...result.items.map((s) => ({ type: 'Site' as const, id: s.id })), { type: 'Site', id: 'LIST' }]
          : [{ type: 'Site', id: 'LIST' }],
    }),
    getSiteDetail: builder.query<Site, string>({
      queryFn: async (id, api) => {
        if (isMockMode) {
          const site = getSiteById(id);
          // Same "not found" (not "forbidden") pattern as the backend -
          // don't reveal that an out-of-scope site id actually exists.
          if (!site || !canAccessState(currentMockUser(api), site.state)) {
            return { error: { status: 404, message: 'Site not found' } };
          }
          const data = await mockResponse(site);
          return { data };
        }
        return restRequest<Site>({ url: `/sites/${id}` });
      },
      providesTags: (_result, _error, id) => [{ type: 'Site', id }],
    }),
    listCircles: builder.query<string[], void>({
      queryFn: async (_arg, api) => {
        if (isMockMode) {
          const user = currentMockUser(api);
          const data = await mockResponse(
            isPanIndia(user) ? circles : [...new Set(restrictSites(user, sites).map((s) => s.circle))].sort()
          );
          return { data };
        }
        return restRequest<string[]>({ url: '/sites/circles' });
      },
    }),
    listStates: builder.query<string[], void>({
      queryFn: async (_arg, api) => {
        if (isMockMode) {
          const data = await mockResponse(restrictStates(currentMockUser(api), states));
          return { data };
        }
        return restRequest<string[]>({ url: '/sites/states' });
      },
    }),
    listDistricts: builder.query<string[], string | void>({
      queryFn: async (state, api) => {
        if (isMockMode) {
          const user = currentMockUser(api);
          if (state && !canAccessState(user, state)) {
            return { data: await mockResponse([]) };
          }
          const list = state
            ? districtsForState(state)
            : isPanIndia(user)
              ? districtsForState(undefined)
              : [...new Set(restrictSites(user, sites).map((s) => s.district))].sort();
          const data = await mockResponse(list);
          return { data };
        }
        return restRequest<string[]>({ url: '/sites/districts', params: { state } });
      },
    }),
    // Curated district list (indus_districts reference table), not derived
    // from real towers' own District field - see this file's REST-contract
    // comment above and the backend's SiteService#listDistrictsFromReferenceTable.
    // Mock mode has no separate curated table, so it falls back to the same
    // tower-derived list listDistricts already uses in mock mode.
    listDistrictsReference: builder.query<string[], string | void>({
      queryFn: async (state, api) => {
        if (isMockMode) {
          const user = currentMockUser(api);
          if (state && !canAccessState(user, state)) {
            return { data: await mockResponse([]) };
          }
          const list = state
            ? districtsForState(state)
            : isPanIndia(user)
              ? districtsForState(undefined)
              : [...new Set(restrictSites(user, sites).map((s) => s.district))].sort();
          const data = await mockResponse(list);
          return { data };
        }
        return restRequest<string[]>({ url: '/sites/districts/reference', params: { state } });
      },
    }),
    listTehsils: builder.query<string[], { state?: string; district?: string } | void>({
      queryFn: async (query, api) => {
        const { state, district } = query ?? {};
        if (isMockMode) {
          const user = currentMockUser(api);
          if (state && !canAccessState(user, state)) {
            return { data: await mockResponse([]) };
          }
          const list = isPanIndia(user)
            ? tehsilsForDistrict(state, district)
            : [
                ...new Set(
                  restrictSites(user, sites)
                    .filter((s) => (!state || s.state === state) && (!district || s.district === district))
                    .map((s) => s.tehsil)
                ),
              ].sort();
          const data = await mockResponse(list);
          return { data };
        }
        return restRequest<string[]>({ url: '/sites/tehsils', params: { state, district } });
      },
    }),
  }),
});

export const {
  useListSitesQuery,
  useGetSiteDetailQuery,
  useListCirclesQuery,
  useListStatesQuery,
  useListDistrictsQuery,
  useListDistrictsReferenceQuery,
  useListTehsilsQuery,
} = sitesApi;
