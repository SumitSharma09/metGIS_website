import { useMemo } from 'react';
import dayjs from 'dayjs';
import { useGetForecastBatchQuery } from '@/features/weather/weatherApi';
import type { ForecastDay } from '@/features/weather/types';

export interface DailyForecastSnapshot {
  offset: number;
  at: string;
  label: string;
  /** Every site's forecast day for this calendar date, keyed by site id -
   *  `expectedRainfallMm` here is a true daily SUM and `maxTemp` a true
   *  daily MAX (see the backend's IndusWeatherMapper.toForecastDay), unlike
   *  useSevenDayObservations's single noon reading. A site with no ingested
   *  forecast rows for this date simply has no entry. */
  bySiteId: Record<string, ForecastDay>;
}

/**
 * Real daily-aggregated forecast (rainfall total, max temperature, ...) for
 * every site over the next 7 days, fetched in ONE request via
 * useGetForecastBatchQuery/POST /weather/forecast/batch - the counterpart to
 * useSevenDayObservations, which only ever returns a single point-in-time
 * (noon) reading per day and can't answer "how much rain fell today" or
 * "what was today's high" correctly. Used by the Reports bulletins (Daily
 * National/Circle Bulletin) for their Rain Fall and Temperature rows.
 *
 * useSevenDayObservations itself is left untouched - it's shared with the
 * Live Map and this bulletin's own Wind row, both of which want a
 * point-in-time snapshot, not a daily aggregate.
 *
 * Matches each site's forecast day to a calendar date by the day's own
 * `date` field (not by array position) - the backend skips days it has no
 * ingested rows for, so two sites' `days` arrays can have gaps in different
 * places and are never safe to index by offset.
 */
// Compares a forecast day's `date` field against a target calendar day
// without assuming exactly how the backend serialized it. Spring Boot
// serializes a bare LocalDate as an ISO string ("2026-09-21") by default,
// but this endpoint is brand new and that's never actually been verified
// against this app's real running backend - a mismatch here (e.g. a
// [year, month, day] array, a full ISO datetime, or a differently-timezoned
// string) would silently make every lookup below fail, for every site,
// every day, which looks exactly like "no data" even though the backend
// sent real numbers back. dayjs(...) parses both a plain date string and a
// full ISO datetime string the same way, and the array form (Jackson's
// WRITE_DATES_AS_TIMESTAMPS shape, 1-indexed month) is normalized by hand
// since dayjs's own array constructor expects a 0-indexed month.
function isSameCalendarDay(rawDate: unknown, target: dayjs.Dayjs): boolean {
  if (Array.isArray(rawDate) && rawDate.length >= 3) {
    const [y, m, d] = rawDate as number[];
    return dayjs(new Date(y, m - 1, d)).isSame(target, 'day');
  }
  if (typeof rawDate === 'string' || typeof rawDate === 'number') {
    const parsed = dayjs(rawDate);
    return parsed.isValid() && parsed.isSame(target, 'day');
  }
  return false;
}

export function useSevenDayForecastTotals(siteIds: string[]) {
  const skip = siteIds.length === 0;
  const { data, isLoading } = useGetForecastBatchQuery({ siteIds, days: 7 }, { skip });

  const days: DailyForecastSnapshot[] = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const dateObj = dayjs().add(i, 'day');
      const bySiteId: Record<string, ForecastDay> = {};
      (data ?? []).forEach((siteForecast) => {
        const day = siteForecast.days.find((d) => isSameCalendarDay(d.date, dateObj));
        if (day) bySiteId[siteForecast.siteId] = day;
      });
      return {
        offset: i,
        at: dateObj.toISOString(),
        label: i === 0 ? 'Today' : dateObj.format('ddd D MMM'),
        bySiteId,
      };
    });
  }, [data]);

  return {
    isLoading: skip ? false : isLoading,
    days,
  };
}
