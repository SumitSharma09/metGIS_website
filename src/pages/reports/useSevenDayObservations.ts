import { useMemo } from 'react';
import dayjs from 'dayjs';
import { useGetObservationsAtTimeQuery } from '@/features/weather/weatherApi';
import type { CurrentObservation } from '@/features/weather/types';

export interface ForecastDaySnapshot {
  offset: number;
  at: string;
  label: string;
  observations: CurrentObservation[];
}

/**
 * Fetches seven fixed daily snapshots (today + 6 days out) for every
 * multi-day forecast surface in the app - the Live Map's daily timeline bar
 * and network-wide weather panel, the Tower Risk Report's region map, the
 * Hazards page's weekly advisories, and the Reports/Bulletin pages' 7-day
 * tables. This used to be two separate hooks (a 5-day one most pages used,
 * and this 7-day one built just for the Reports scope document's Short/
 * Long-Range table), but the whole app now standardizes on one 7-day
 * horizon, so there's no reason to keep two. The number of days is fixed,
 * so calling the query hook a fixed number of times (rather than in a loop)
 * keeps this a valid, order-stable use of hooks.
 *
 * By default every day is sampled at noon, fixed for the lifetime of the
 * page view - right for the Bulletins/Hazards/Reports pages, which should
 * show one stable forecast per page load, not something that silently
 * shifts under the reader.
 *
 * `options.sampleHour` (0-23) overrides that fixed noon and is included in
 * the memo's own dependencies, so passing a value that changes over time
 * makes every day's snapshot re-fetch at that new hour. This is what the
 * Live Map's own two calls (in `LiveMapPage.tsx`) use, passing the bottom
 * timeline scrubber's currently-selected hour - added 2026-09-22 because the
 * "7-DAY FORECAST" panel looked frozen while scrubbing the hourly slider:
 * the scrubber's `at` only ever fed the map's colors and "current
 * conditions" stat boxes, never this hook, so the forecast boxes' numbers
 * genuinely could not change no matter how far the slider moved. Every
 * other caller omits `options`, so it keeps the exact previous noon-fixed,
 * once-per-mount behavior unchanged.
 */
export function useSevenDayObservations(siteIds: string[], options?: { sampleHour?: number }) {
  const skip = siteIds.length === 0;
  const sampleHour = options?.sampleHour ?? 12;
  const dates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => dayjs().add(i, 'day').hour(sampleHour).minute(0).second(0).toISOString()),
    [sampleHour]
  );

  const q0 = useGetObservationsAtTimeQuery({ siteIds, at: dates[0] }, { skip });
  const q1 = useGetObservationsAtTimeQuery({ siteIds, at: dates[1] }, { skip });
  const q2 = useGetObservationsAtTimeQuery({ siteIds, at: dates[2] }, { skip });
  const q3 = useGetObservationsAtTimeQuery({ siteIds, at: dates[3] }, { skip });
  const q4 = useGetObservationsAtTimeQuery({ siteIds, at: dates[4] }, { skip });
  const q5 = useGetObservationsAtTimeQuery({ siteIds, at: dates[5] }, { skip });
  const q6 = useGetObservationsAtTimeQuery({ siteIds, at: dates[6] }, { skip });
  const queries = [q0, q1, q2, q3, q4, q5, q6];

  const days: ForecastDaySnapshot[] = dates.map((at, i) => ({
    offset: i,
    at,
    label: i === 0 ? 'Today' : dayjs(at).format('ddd D MMM'),
    observations: queries[i].data ?? [],
  }));

  return {
    isLoading: queries.some((q) => q.isLoading),
    days,
  };
}
