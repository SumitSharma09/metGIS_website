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
 */
export function useSevenDayObservations(siteIds: string[]) {
  const skip = siteIds.length === 0;
  const dates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => dayjs().add(i, 'day').hour(12).minute(0).second(0).toISOString()),
    // Recomputed once per mount/day - stable for the lifetime of the page view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
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
