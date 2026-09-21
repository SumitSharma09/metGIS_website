import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { useClock } from '@/utils/useClock';

export type TimelineSpeed = 1 | 2 | 4;
export type TimelineMode = 'daily' | 'hourly';

const TIMELINE_DAYS = 7;
const HOURS_PER_DAY = 24;
const TOTAL_HOUR_STEPS = TIMELINE_DAYS * HOURS_PER_DAY;
const BASE_STEP_MS = 2200;

/**
 * Drives the map's bottom timeline scrubber, in one of two modes:
 *  - "daily": the 7-day outlook - day 0 is "now", days 1-6 are the upcoming
 *    forecast horizon, each sampled at midday. Matches the 7-day horizon
 *    used everywhere else in the app (Reports/Bulletins' useSevenDayObservations,
 *    Hazards' weekly advisories, Site Detail's forecast).
 *  - "hourly": a finer-grained scrub hour by hour across the *same* 7-day
 *    horizon (168 steps total), for reading how conditions move through
 *    each day rather than only seeing one midday snapshot per day. This
 *    used to be limited to just today's 24 hours; it now covers the full
 *    week so scrubbing hour-by-hour into upcoming days is possible too.
 * Both reuse the same deterministic mock generator as the rest of the app
 * (via the offset -> ISO timestamp this hook produces), so scrubbing either
 * one shows a plausible, stable reading rather than random noise. Switching
 * modes pauses playback, so flipping from one bar to the other never leaves
 * a hidden interval quietly advancing the other bar's state in the
 * background.
 */
export function useMapTimeline() {
  const [mode, setMode] = useState<TimelineMode>('daily');
  const [dayOffset, setDayOffset] = useState(0);
  // A single combined index across the whole 7-day x 24-hour grid (0-167),
  // rather than an hour-of-today value, so the hourly bar can scrub into
  // upcoming days too. Starts at "right now" within day 0.
  const [hourOffset, setHourOffset] = useState(() => dayjs().hour());
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<TimelineSpeed>(1);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = window.setInterval(() => {
      if (mode === 'daily') {
        setDayOffset((prev) => (prev + 1) % TIMELINE_DAYS);
      } else {
        setHourOffset((prev) => (prev + 1) % TOTAL_HOUR_STEPS);
      }
    }, BASE_STEP_MS / speed);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [playing, speed, mode]);

  const changeMode = (next: TimelineMode) => {
    setPlaying(false);
    setMode(next);
  };

  const days = useMemo(
    () =>
      Array.from({ length: TIMELINE_DAYS }, (_, i) => {
        const date = dayjs().add(i, 'day');
        return { offset: i, date, label: i === 0 ? 'Today' : date.format('ddd D MMM') };
      }),
    []
  );

  // 168 combined day+hour steps. Each entry knows both its time-of-day
  // label ("3 AM") and which day it falls on ("Today" / "Tue 16 Sep"), so
  // the scrubber can show "Tue 16 Sep, 3 AM" once it's scrubbed past today.
  const hours = useMemo(
    () =>
      Array.from({ length: TOTAL_HOUR_STEPS }, (_, i) => {
        const dayIndex = Math.floor(i / HOURS_PER_DAY);
        const hourOfDay = i % HOURS_PER_DAY;
        const date = dayjs().add(dayIndex, 'day').hour(hourOfDay).minute(0);
        return {
          offset: i,
          dayIndex,
          label: date.format('h A'),
          dayLabel: dayIndex === 0 ? 'Today' : date.format('ddd D MMM'),
        };
      }),
    []
  );

  const selectedDate = days[dayOffset]?.date ?? dayjs();
  const selectedHour = hours[hourOffset] ?? hours[0];
  const hourOfDay = hourOffset % HOURS_PER_DAY;
  // A minute-granularity "now" instead of calling dayjs() fresh below: this
  // hook re-renders constantly (playback tick, map pan/zoom, any parent
  // state change), and `at` feeds straight into
  // useGetObservationsAtTimeQuery({ siteIds, at }) - RTK Query keys its
  // cache/dedup on the exact `at` string, so a value that differs by a few
  // milliseconds on every render (dayjs().toISOString() used to be called
  // directly in the render body here) makes EVERY render look like a brand
  // new query. That cancels whatever observations request was already
  // in-flight and starts another one, forever, before any one of them ever
  // gets to finish - the Live Map's colors and the district panel's data
  // then never load (visible in the browser's Network tab as the batch
  // endpoint's requests permanently stuck in a cancelled/NS_BINDING_ABORTED
  // state - found 2026-09-18 chasing "no data of any parameters"). Ticking
  // once a minute keeps this "live" in every way that matters (this app's
  // real data granularity is hourly anyway) while giving each request a
  // full minute to actually complete.
  const now = useClock(60000);
  // Daily mode samples each FUTURE day at midday, matching the daily
  // outlook - but "Today" (dayOffset 0, the default the map opens on) used
  // to also get pinned to a fixed 12:00 noon timestamp. Since the daily bar
  // starts on "Today" and most people never touch the scrubber at all, that
  // meant the map's default view - every district's risk color, its
  // tooltip, and the popup you get from clicking a district - was
  // permanently showing a noon snapshot rather than the actual live
  // reading: read it at 4 PM and you saw data already several hours stale
  // ("previous update"), read it at 9 AM and you'd actually see a snapshot
  // from the FUTURE relative to right now. "Today" now resolves to the
  // genuine current instant instead, so the default/live view is actually
  // live; only a deliberately-picked future outlook day still samples at
  // midday (there is no "now" for a day that hasn't happened yet). Hourly
  // mode is unaffected - scrubbing to today's current hour already lines up
  // with "now" to within the hour, which matches this app's real data
  // granularity (hourly_weather rows).
  const at =
    mode === 'daily'
      ? dayOffset === 0
        ? now.toISOString()
        : selectedDate.hour(12).minute(0).second(0).toISOString()
      : dayjs().add(selectedHour.dayIndex, 'day').hour(hourOfDay).minute(0).second(0).toISOString();

  return {
    mode,
    setMode: changeMode,
    days,
    dayOffset,
    setDayOffset,
    hours,
    hourOffset,
    setHourOffset,
    playing,
    togglePlaying: () => setPlaying((p) => !p),
    speed,
    setSpeed,
    at,
    isToday: mode === 'daily' ? dayOffset === 0 : selectedHour.dayIndex === 0,
  };
}
