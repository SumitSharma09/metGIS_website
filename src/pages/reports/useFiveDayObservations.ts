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
 * Fetches five fixed daily snapshots (today + 4 days out) for the Tower
 * Risk Reports regional heatmap. The number of days is fixed, so calling
 * the query hook a fixed number of times (rather than in a loop) keeps
 * this a valid, order-stable use of hooks.
 */
export function useFiveDayObservations(siteIds: string[]) {
  const skip = siteIds.length === 0;
  const dates = useMemo(
    () => Array.from({ length: 5 }, (_, i) => dayjs().add(i, 'day').hour(12).minute(0).second(0).toISOString()),
    // Recomputed once per mount/day - stable for the lifetime of the page view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const q0 = useGetObservationsAtTimeQuery({ siteIds, at: dates[0] }, { skip });
  const q1 = useGetObservationsAtTimeQuery({ siteIds, at: dates[1] }, { skip });
  const q2 = useGetObservationsAtTimeQuery({ siteIds, at: dates[2] }, { skip });
  const q3 = useGetObservationsAtTimeQuery({ siteIds, at: dates[3] }, { skip });
  const q4 = useGetObservationsAtTimeQuery({ siteIds, at: dates[4] }, { skip });
  const queries = [q0, q1, q2, q3, q4];

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
