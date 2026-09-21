import dayjs from 'dayjs';
import { apiSlice } from '@/api/apiSlice';
import { restRequest, isMockMode, currentMockUser } from '@/api/queryHelpers';
import { mockResponse } from '@/api/mock/db';
import { getCurrentObservation, getHistoricalSeries, getForecast, generateObservationAt } from '@/api/mock/data/weather';
import { sites, getSiteById } from '@/api/mock/data/sites';
import { canAccessState, restrictSites } from '@/utils/accessScope';
import type { CurrentObservation, ForecastDay, ForecastQuery, HistoricalPoint, HistoricalQuery, SiteForecast } from './types';

/**
 * REST contract:
 *   POST /weather/current/batch  { siteIds?, at? } -> CurrentObservation[]  (all sites if siteIds omitted;
 *                                                 "now" if at omitted) - used for getCurrentObservations and
 *                                                 getObservationsAtTime below. A whole Indus circle can have
 *                                                 5,000-19,000+ monitored towers, and the Live Map's
 *                                                 nationwide/circle-wide choropleth + wind-flow overlay both
 *                                                 request weather for every site in scope at once, so the id
 *                                                 list goes in the POST body rather than a GET query string -
 *                                                 joining that many ids into a URL blows past the server's
 *                                                 (and browser's) request-line/header size limit and the
 *                                                 request never arrives, silently leaving those views with no
 *                                                 observations at all.
 *   GET /weather/current/:siteId              -> CurrentObservation
 *   GET /weather/historical?siteId=&from=&to=&interval=hourly|daily -> HistoricalPoint[]
 *   GET /weather/forecast/:siteId?days=7      -> ForecastDay[]
 *   POST /weather/forecast/batch { siteIds, days? } -> SiteForecast[] - batch
 *                                                 form of the line above, for
 *                                                 the Reports bulletins,
 *                                                 which need real daily-
 *                                                 aggregated (SUM rainfall,
 *                                                 MAX temperature) forecast
 *                                                 days for hundreds of sites
 *                                                 at once (see
 *                                                 useSevenDayForecastTotals).
 */
export const weatherApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCurrentObservations: builder.query<CurrentObservation[], string[] | void>({
      queryFn: async (siteIds, api) => {
        if (isMockMode) {
          const user = currentMockUser(api);
          // RBAC: "all sites" only ever means "all sites in scope"; a
          // caller naming specific IDs only gets back the in-scope ones.
          const ids = siteIds && siteIds.length
            ? siteIds.filter((id) => canAccessState(user, getSiteById(id)?.state))
            : restrictSites(user, sites).map((s) => s.id);
          const data = await mockResponse(ids.map((id) => getCurrentObservation(id)));
          return { data };
        }
        return restRequest<CurrentObservation[]>({
          url: '/weather/current/batch',
          method: 'POST',
          data: siteIds ? { siteIds } : {},
        });
      },
    }),
    getCurrentObservationBySite: builder.query<CurrentObservation, string>({
      queryFn: async (siteId, api) => {
        if (isMockMode) {
          if (!canAccessState(currentMockUser(api), getSiteById(siteId)?.state)) {
            return { error: { status: 404, message: 'Site not found' } };
          }
          const data = await mockResponse(getCurrentObservation(siteId));
          return { data };
        }
        return restRequest<CurrentObservation>({ url: `/weather/current/${siteId}` });
      },
    }),
    getObservationsAtTime: builder.query<CurrentObservation[], { siteIds?: string[]; at: string }>({
      queryFn: async ({ siteIds, at }, api) => {
        if (isMockMode) {
          const user = currentMockUser(api);
          const ids = siteIds && siteIds.length
            ? siteIds.filter((id) => canAccessState(user, getSiteById(id)?.state))
            : restrictSites(user, sites).map((s) => s.id);
          const data = await mockResponse(ids.map((id) => generateObservationAt(id, dayjs(at))));
          return { data };
        }
        return restRequest<CurrentObservation[]>({
          url: '/weather/current/batch',
          method: 'POST',
          data: { siteIds, at },
        });
      },
    }),
    getHistoricalData: builder.query<HistoricalPoint[], HistoricalQuery>({
      queryFn: async ({ siteId, from, to, interval }, api) => {
        if (isMockMode) {
          if (!canAccessState(currentMockUser(api), getSiteById(siteId)?.state)) {
            return { error: { status: 404, message: 'Site not found' } };
          }
          const data = await mockResponse(getHistoricalSeries(siteId, from, to, interval));
          return { data };
        }
        return restRequest<HistoricalPoint[]>({
          url: '/weather/historical',
          params: { siteId, from, to, interval },
        });
      },
    }),
    getForecast: builder.query<ForecastDay[], ForecastQuery>({
      queryFn: async ({ siteId, days }, api) => {
        if (isMockMode) {
          if (!canAccessState(currentMockUser(api), getSiteById(siteId)?.state)) {
            return { error: { status: 404, message: 'Site not found' } };
          }
          const data = await mockResponse(getForecast(siteId, days));
          return { data };
        }
        return restRequest<ForecastDay[]>({ url: `/weather/forecast/${siteId}`, params: { days } });
      },
    }),
    getForecastBatch: builder.query<SiteForecast[], { siteIds: string[]; days?: number }>({
      queryFn: async ({ siteIds, days }, api) => {
        if (isMockMode) {
          const user = currentMockUser(api);
          const ids = siteIds.filter((id) => canAccessState(user, getSiteById(id)?.state));
          const data = await mockResponse(ids.map((id) => ({ siteId: id, days: getForecast(id, days) })));
          return { data };
        }
        return restRequest<SiteForecast[]>({
          url: '/weather/forecast/batch',
          method: 'POST',
          data: { siteIds, days },
        });
      },
    }),
  }),
});

export const {
  useGetCurrentObservationsQuery,
  useGetCurrentObservationBySiteQuery,
  useGetObservationsAtTimeQuery,
  useGetHistoricalDataQuery,
  useGetForecastQuery,
  useGetForecastBatchQuery,
} = weatherApi;
