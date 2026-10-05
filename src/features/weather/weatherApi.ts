import dayjs from 'dayjs';
import { apiSlice } from '@/api/apiSlice';
import { restRequest, isMockMode, currentMockUser } from '@/api/queryHelpers';
import { mockResponse } from '@/api/mock/db';
import { getCurrentObservation, getHistoricalSeries, getForecast, generateObservationAt } from '@/api/mock/data/weather';
import { sites, getSiteById } from '@/api/mock/data/sites';
import { canAccessState, restrictSites } from '@/utils/accessScope';
import type {
  CurrentObservation,
  ForecastDay,
  ForecastQuery,
  HistoricalPoint,
  HistoricalQuery,
  SiteForecast,
  SkymetDistrictForecast,
  SkymetForecastDay,
  SkymetForecastQuery,
} from './types';

/**
 * One real district's averaged current reading - the nationwide Live Map
 * choropleth's data source as of 2026-09-30 (see getDistrictAggregate
 * below), replacing "fetch every individual tower and average client-side"
 * for that view specifically. `state` is the raw, unsplit circle-style
 * value (e.g. "Bihar & Jharkhand") - callers still run it through
 * splitCircleStateName() same as any other Site.state. `observation.siteId`
 * is a synthetic "district:<district>" id, not a real tower id.
 */
export interface DistrictWeatherAggregate {
  district: string;
  state: string;
  siteCount: number;
  observation: CurrentObservation;
}

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
 *   GET /weather/forecast/skymet?district=&state= -> SkymetForecastDay[] -
 *                                                 a completely separate real
 *                                                 per-day vendor feed (not
 *                                                 derived from hourly_weather
 *                                                 at all), added 2026-09-22
 *                                                 for the Live Map's 7-Day
 *                                                 Forecast Outlook panel. No
 *                                                 mock-mode equivalent exists
 *                                                 (see getSkymetForecast
 *                                                 below) - there is no
 *                                                 synthetic version of this
 *                                                 vendor data to fall back
 *                                                 to.
 *   GET /weather/forecast/skymet/all           -> SkymetDistrictForecast[] -
 *                                                 bulk form of the line
 *                                                 above, every district's
 *                                                 outlook in one call, added
 *                                                 2026-09-22 for the Reports
 *                                                 bulletins/Tower Risk table
 *                                                 and the Alerts page's
 *                                                 forecast-alert feed (see
 *                                                 useSkymetSevenDayForecast).
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
    /**
     * District-level aggregate for the Live Map's nationwide (no-state-
     * selected) choropleth - GET /weather/district-aggregate, ~211 rows
     * (one per real district with data) instead of every individual tower.
     * Added 2026-09-30: nationwide's per-tower fetch (getObservationsAtTime
     * above, with every circle's sites) was confirmed still stuck even
     * after backend query parallelization, the hourly_weather composite
     * index, and a raised connection pool - three rounds of tuning the same
     * "fetch every tower" shape. This sidesteps all of that with a single
     * server-side SQL GROUP BY. Mock mode has no district-grouped data
     * source to call, so it synthesizes one district entry per distinct
     * mock district instead (one representative site's observation per
     * district - adequate for demo data, never used for real Indus data).
     */
    getDistrictAggregate: builder.query<DistrictWeatherAggregate[], { at: string }>({
      queryFn: async ({ at }) => {
        if (isMockMode) {
          const byDistrict = new Map<string, { state: string; ids: string[] }>();
          sites.forEach((s) => {
            const group = byDistrict.get(s.district) ?? { state: s.state, ids: [] };
            group.ids.push(s.id);
            byDistrict.set(s.district, group);
          });
          const data: DistrictWeatherAggregate[] = await mockResponse(
            Array.from(byDistrict.entries()).map(([district, group]) => {
              const obs = generateObservationAt(group.ids[0], dayjs(at));
              return {
                district,
                state: group.state,
                siteCount: group.ids.length,
                observation: { ...obs, siteId: `district:${district}` },
              };
            })
          );
          return { data };
        }
        return restRequest<DistrictWeatherAggregate[]>({
          url: '/weather/district-aggregate',
          params: { at },
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
    /**
     * Real district-level 7-day outlook from the Skymet feed - see this
     * file's REST-contract comment above. No mock-mode branch fetches
     * anything computed: mock mode returns an empty array, same as the real
     * backend does when Indus/Skymet isn't enabled (see
     * WeatherService#skymetForecast on the backend) - there's no synthetic
     * per-day vendor forecast to fabricate, unlike getForecast above (which
     * has a real mock generator behind it).
     */
    getSkymetForecast: builder.query<SkymetForecastDay[], SkymetForecastQuery>({
      queryFn: async ({ district, state }) => {
        if (isMockMode) {
          const data = await mockResponse([] as SkymetForecastDay[]);
          return { data };
        }
        return restRequest<SkymetForecastDay[]>({
          url: '/weather/forecast/skymet',
          params: { district, state },
        });
      },
    }),
    /**
     * Bulk form of getSkymetForecast above - every district's 7-day Skymet
     * outlook in one request (GET /weather/forecast/skymet/all), added
     * 2026-09-22 so the Reports bulletins, Tower Risk table and Alerts
     * page's forecast-alert feed don't have to issue one
     * getSkymetForecast call per district - see
     * src/pages/reports/useSkymetSevenDayForecast.ts. Same no-mock-data
     * rule as getSkymetForecast: mock mode returns an empty array, never a
     * fabricated per-day vendor figure.
     */
    getSkymetForecastAll: builder.query<SkymetDistrictForecast[], void>({
      queryFn: async () => {
        if (isMockMode) {
          const data = await mockResponse([] as SkymetDistrictForecast[]);
          return { data };
        }
        return restRequest<SkymetDistrictForecast[]>({ url: '/weather/forecast/skymet/all' });
      },
    }),
  }),
});

export const {
  useGetCurrentObservationsQuery,
  useGetCurrentObservationBySiteQuery,
  useGetObservationsAtTimeQuery,
  useGetDistrictAggregateQuery,
  useGetHistoricalDataQuery,
  useGetForecastQuery,
  useGetForecastBatchQuery,
  useGetSkymetForecastQuery,
  useGetSkymetForecastAllQuery,
} = weatherApi;
