import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { useClock } from '@/utils/useClock';

// Was `1 | 2 | 4` - narrowed to `0.5 | 1 | 2` (4x removed, 0.5x added) on
// 2026-09-29 per explicit request ("data is slow changes why??? if timeline
// fast please slow this remove 4x do only .5x 1x 2x only. but data show as
// per the timeline this is veryimportant"). Root cause of the reported lag:
// the map's colors/tooltips don't fetch a fresh reading for every tick - the
// hourly value driving them (`debouncedAt`, further down in this file) only
// updates 400ms after `at` stops changing (`useDebouncedValue(timeline.at,
// 400)` in LiveMapPage.tsx - see that file's own comment on why this
// debounce exists). At 4x, `BASE_STEP_MS / speed` = 2200/4 = 550ms between
// ticks - barely above that 400ms window, and often less than the 400ms
// debounce PLUS however long the actual network fetch itself takes on top -
// so a new tick regularly arrived before the previous one's debounce timer
// (which resets on every change) ever got to fire a request, let alone have
// it resolve. The slider's own position/label (`displayAt`) has no debounce
// and always kept advancing on time regardless, which is exactly the
// symptom described: the timeline itself moves smoothly, but the real
// data (colors, tooltip readings) visibly lags behind it, only catching up
// once playback paused or slowed down long enough for a request to land.
// Every remaining speed's tick interval (4400ms at 0.5x, 2200ms at 1x,
// 1100ms at 2x) comfortably clears the 400ms debounce plus ordinary fetch
// latency, so removing 4x (rather than only adding 0.5x) is the actual fix -
// not just a slower option alongside a still-broken fast one.
export type TimelineSpeed = 0.5 | 1 | 2;
export type TimelineMode = 'daily' | 'hourly';

const TIMELINE_DAYS = 7;
const HOURS_PER_DAY = 24;
// Hourly bar window - narrowed from 7 days (168 steps) to 3 days (72 steps)
// on 2026-09-23 per explicit request ("remove or comment the 7 days slider
// and work on only 3-days hourly wise slider(Mentions in scope of work)") -
// the scope document's short-range weather monitoring window is 3 days, so
// the Live Map's hourly scrubber matched that instead of the full 7-day
// forecast horizon.
// Briefly narrowed further to 2 days (Today/Tomorrow only) on 2026-09-24,
// then reverted back to 3 the same day per an explicit follow-up request
// ("slider work on 3 days") - back to matching the scope document's 3-day
// short-range window. The day-label helper below still spells out "Today"/
// "Tomorrow" by name for whichever of the 3 days those are, so that part of
// the 2-day change is kept. Kept as its own constant, separate from
// TIMELINE_DAYS (still 7, still driving the dormant daily-mode `days` array
// below), so the original 7-day bar can be restored at its old width if
// ever re-enabled - see the 'daily' mode/UI note further down.
const HOURLY_WINDOW_DAYS = 3;
const TOTAL_HOUR_STEPS = HOURLY_WINDOW_DAYS * HOURS_PER_DAY;
const BASE_STEP_MS = 2200;

/** Rounds a dayjs instant forward to the next full hour (exactly on the hour
 *  stays put) - the same rounding `displayAt` below uses for the tooltip
 *  label, reused here so the hourly slider's live "current" position lines
 *  up with real hourly data granularity instead of the exact minute. */
function nextFullHour(instant: dayjs.Dayjs): dayjs.Dayjs {
  return instant.minute() === 0 && instant.second() === 0 ? instant : instant.add(1, 'hour').startOf('hour');
}

/** Turns `nextFullHour(instant)` into a flat 0-71 index into `hours` below,
 *  anchored to TODAY's real midnight (recomputed fresh, so this stays
 *  correct across a midnight rollover) - added 2026-09-23 alongside the
 *  "data frozen for every early hour" fix (see `minHourOffset`'s own doc
 *  comment further down). Using `.hour()` alone here would have been wrong
 *  right around midnight: rounding 23:45 forward lands on TOMORROW's 00:00,
 *  and `.hour()` on that instant reads back as 0 - the SAME as TODAY's own
 *  midnight - silently pointing at the wrong day. Diffing from today's own
 *  midnight avoids that, and is clamped into the valid [0, TOTAL_HOUR_STEPS)
 *  range as a last-resort guard. */
function liveHourIndex(instant: dayjs.Dayjs): number {
  const rounded = nextFullHour(instant);
  const diffHours = rounded.diff(dayjs().startOf('day'), 'hour');
  return Math.max(0, Math.min(TOTAL_HOUR_STEPS - 1, diffHours));
}

/**
 * Drives the map's bottom timeline scrubber. Originally had two modes;
 * as of 2026-09-23, only one is reachable from the UI:
 *  - "hourly" (now the only mode the UI exposes): a scrub hour by hour
 *    across a 3-day short-range window (72 steps total - HOURLY_WINDOW_DAYS
 *    above), for reading how conditions move through each day. Its default/
 *    "current" position live-follows the real clock, rounded forward to the
 *    next full hour (see `nextFullHour`/`liveTracking`), until the user
 *    scrubs or presses play.
 *  - "daily" (DISABLED - see the 'hourly' default below): used to be the
 *    7-day outlook, day 0 "now" and days 1-6 sampled at midday. Removed from
 *    the UI per explicit request ("remove or comment the 7 days slider and
 *    work on only 3-days hourly wise slider(Mentions in scope of work)") -
 *    the scope document's short-range monitoring window is 3 days, and the
 *    Live Map now shows only the hourly bar to match. The 'daily' code path
 *    (this hook's `days`/`dayOffset`/`setDayOffset`, TimelineScrubber's own
 *    daily-slider branch) is left in place rather than deleted, so it's a
 *    quick revert if the 7-day bar is ever wanted back - just re-add its
 *    ToggleButtonGroup in TimelineScrubber.tsx and flip the default mode
 *    back to 'daily' here.
 * Both reuse the same deterministic mock generator as the rest of the app
 * (via the offset -> ISO timestamp this hook produces) in mock mode, so
 * scrubbing shows a plausible, stable reading rather than random noise.
 * Switching modes pauses playback, so flipping from one bar to the other
 * never leaves a hidden interval quietly advancing the other bar's state in
 * the background.
 */
export function useMapTimeline() {
  // Defaults to 'hourly' (was 'daily') as of 2026-09-23 - the daily 7-day
  // mode/UI is disabled per the same request that narrowed the hourly window
  // above (TimelineScrubber.tsx no longer renders a way to switch back to
  // 'daily'), so opening the map on 'daily' would have shown a bar with no
  // way off it. The 'daily' branches throughout this hook are left in place,
  // just unreachable from the UI now, so this is a one-line revert if the
  // 7-day bar ever comes back.
  const [mode, setMode] = useState<TimelineMode>('hourly');
  const [dayOffset, setDayOffset] = useState(0);
  // A single combined index across the whole 3-day x 24-hour grid (0-71),
  // rather than an hour-of-today value, so the hourly bar can scrub into
  // upcoming days too. Starts at the next full hour from right now (see
  // `liveTracking` below for why it's not simply "the current hour").
  const [hourOffset, setHourOffset] = useState(() => liveHourIndex(dayjs()));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<TimelineSpeed>(1);
  const intervalRef = useRef<number | null>(null);
  // Whether the hourly slider should keep following the real clock. True
  // until the user takes the wheel (drags the slider or presses play), at
  // which point it's their scrub position to keep, not something that should
  // silently jump back to "now" out from under them. Added 2026-09-23 per
  // explicit request: "they start same as forecast hour like current time
  // 4:20 then start slider 5:00 and 5:01 then start 6 like this" - the
  // slider's default/current position rounds forward to the next full hour
  // (see `nextFullHour`) and keeps advancing to the next one as real time
  // crosses each hour boundary, matching this app's real hourly data
  // granularity instead of ticking by the minute.
  const [liveTracking, setLiveTracking] = useState(true);

  // Added 2026-09-30 ("timeline running even loading... this is not good. if
  // loading show then timeline stop after loading complete they start at
  // same time"): before this, the playback interval below always advanced
  // `hourOffset` on schedule regardless of whether the map's own data had
  // actually caught up - by design, so the slider itself never visibly
  // freezes (see BASE_STEP_MS's own doc comment on `TimelineSpeed`). That
  // was fine for ordinary tick-to-tick latency, but looked wrong once
  // LiveMapPage's own `ProcessingOverlay` popup is showing - the user
  // watches the map say "Loading weather data..." while the slider keeps
  // right on advancing to the NEXT hour, several ticks deep, before the
  // loading one ever lands. `holdPlayback` (set by LiveMapPage via
  // `setHoldPlayback`, from the exact same `processingLabel` the popup
  // renders) freezes the slider at its current position - not paused/
  // stopped, `playing` stays true and the play button keeps showing pause -
  // for as long as the popup is up, then resumes ticking from that same
  // position the instant it clears, rather than jumping ahead to "catch up"
  // to where it would have been.
  const [holdPlayback, setHoldPlayback] = useState(false);

  // A minute-granularity "now" (see its own fuller doc comment further down,
  // by `at`) - moved up here so `minHourOffset` below (needed by the
  // playback effect) can be derived from it.
  const now = useClock(60000);

  // Earliest hourly-slider position that's actually safe to show as real
  // data, rather than a borrowed/fallback reading - added 2026-09-23 after
  // diagnosing "if i start the hourly slider then data remains unchanged for
  // all hours...data not shown for every hours in mouse over". Root cause
  // (confirmed via a real `SELECT location_id, COUNT(*), MIN(datetime),
  // MAX(datetime) FROM hourly_weather GROUP BY location_id` the user ran):
  // `hourly_weather` only has real ingested rows from roughly "now" onward
  // (e.g. earliest row today at 17:00) - there is no real data for EARLIER
  // hours of today. The backend's `IndusWeatherService.currentForBatch`
  // still answers a request for an earlier hour (it falls back to each
  // location's single EARLIEST row via `findEarliestByLocationIds` when
  // nothing exists at-or-before the requested instant), but every one of
  // those earlier-hour requests then resolves to that exact same fallback
  // row - which is exactly why the map looked frozen/unchanged across the
  // early hours of "Today." Clamping the slider so it can't be scrubbed (or
  // played, or live-tracked) earlier than the current live hour keeps every
  // reachable position backed by a genuine, distinct real reading - matching
  // this project's "never show fabricated/mismatched data" rule, and also
  // matching what the user's own request only ever described (scrubbing
  // FORWARD from "now," never backward into earlier-today).
  const minHourOffset = useMemo(() => liveHourIndex(now), [now]);

  useEffect(() => {
    // `holdPlayback` (see its own doc comment above) freezes the slider
    // in-place without touching `playing` - clearing the interval here (same
    // as the ordinary not-playing case) rather than merely skipping a tick
    // inside it means no queued-up ticks fire the instant it clears either;
    // the very next tick starts a fresh full-length wait from wherever
    // `hourOffset` was sitting, exactly matching "after loading complete
    // they start at same time."
    if (!playing || holdPlayback) {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = window.setInterval(() => {
      if (mode === 'daily') {
        setDayOffset((prev) => (prev + 1) % TIMELINE_DAYS);
      } else {
        // Wraps back to the live floor (not hour 0) once playback reaches
        // the end of the 3-day window, so a looping play never lands back
        // in the pre-"now" stretch of today that has no real data - see
        // `minHourOffset`'s own doc comment above.
        setHourOffset((prev) => (prev + 1 > TOTAL_HOUR_STEPS - 1 ? minHourOffset : prev + 1));
      }
    }, BASE_STEP_MS / speed);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [playing, speed, mode, minHourOffset, holdPlayback]);

  const changeMode = (next: TimelineMode) => {
    setPlaying(false);
    setMode(next);
  };

  // Manual scrub - marks liveTracking false so the effect below stops
  // overwriting the user's chosen hour on the next clock tick. Also clamped
  // to minHourOffset as a last-resort guard (the Slider's own `min` prop is
  // the primary way this can't happen from the UI) so nothing can ever
  // programmatically scrub into the no-real-data stretch of today.
  const changeHourOffset = (offset: number) => {
    setLiveTracking(false);
    setHourOffset(Math.max(offset, minHourOffset));
  };

  // Pressing play also takes manual control (same reasoning as scrubbing):
  // once the user starts playback, the slider is running on its own
  // schedule, not "now" - pausing again shouldn't suddenly snap it back to
  // the live hour out from under whatever the playback landed on.
  const togglePlaying = () => {
    setPlaying((p) => {
      if (!p) setLiveTracking(false);
      return !p;
    });
  };

  // Snaps the hourly slider back to its starting/live position and resumes
  // live-tracking, without touching `mode`/`speed` - added 2026-09-30 per
  // explicit request ("if someone change paramter choose in map they
  // timeline start with the starting and if choose the district also the
  // timeline start from the starting"). Before this, scrubbing or playing
  // the timeline forward, then switching the active parameter or picking a
  // different district, left the slider sitting wherever it had been - so a
  // freshly-picked district's colors/tooltip could be read against a stale,
  // arbitrary hour from browsing the PREVIOUS selection, with nothing on
  // screen to suggest that. `changeHourOffset`'s own clamp-to-`minHourOffset`
  // is reused here rather than resetting to a fixed 0, since 0 can be
  // earlier than the live floor (see `minHourOffset`'s own doc comment on
  // why); the "starting" position in this app is always the current live
  // hour, never an arbitrary hour of today that may have no real data yet.
  const resetToLive = () => {
    setPlaying(false);
    setLiveTracking(true);
    setHourOffset(minHourOffset);
  };

  const days = useMemo(
    () =>
      Array.from({ length: TIMELINE_DAYS }, (_, i) => {
        const date = dayjs().add(i, 'day');
        return { offset: i, date, label: i === 0 ? 'Today' : date.format('ddd D MMM') };
      }),
    []
  );

  // 72 combined day+hour steps (3 days x 24 hours - see HOURLY_WINDOW_DAYS
  // above). Each entry knows both its time-of-day label ("3 AM") and which
  // day it falls on ("Today" / "Tomorrow" / "Wed 25 Sep"), so the scrubber
  // can show "Tomorrow, 3 AM" once it's scrubbed past today. `dayLabel`
  // spells out "Tomorrow" by name (rather than the weekday/date) for
  // dayIndex 1 as of 2026-09-24 - a plain-English day name reads faster for
  // a non-technical viewer than a calendar date does. dayIndex 2 (the third
  // day) still falls back to the weekday/date format below, since only
  // "Today" and "Tomorrow" have unambiguous everyday names.
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
          dayLabel: dayIndex === 0 ? 'Today' : dayIndex === 1 ? 'Tomorrow' : date.format('ddd D MMM'),
        };
      }),
    []
  );

  const selectedDate = days[dayOffset]?.date ?? dayjs();
  const selectedHour = hours[hourOffset] ?? hours[0];
  const hourOfDay = hourOffset % HOURS_PER_DAY;
  // `now` itself is declared further up (see minHourOffset's doc comment for
  // why it moved) - kept as a minute-granularity clock rather than calling
  // dayjs() fresh below: this hook re-renders constantly (playback tick, map
  // pan/zoom, any parent state change), and `at` feeds straight into
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

  // Live-follow effect: while liveTracking is on (see its own doc comment
  // above - true until the user scrubs or hits play), keeps the hourly
  // slider's position pinned to minHourOffset (the next full hour from
  // `now`), so it advances on its own as real time crosses each hour
  // boundary (current time 4:20 -> slider shows 5:00; once real time reaches
  // 5:01, the slider advances to show 6:00) instead of staying wherever it
  // happened to be at mount. Guarded on `mode === 'hourly'` (always true
  // today, see the 'hourly' default above, but keeps this inert if 'daily'
  // mode is ever re-enabled) and `!playing` (the playback interval above
  // already owns hourOffset while playing).
  useEffect(() => {
    if (!liveTracking || mode !== 'hourly' || playing) return;
    setHourOffset((prev) => (prev === minHourOffset ? prev : minHourOffset));
  }, [minHourOffset, liveTracking, mode, playing]);

  // Safety net, independent of liveTracking/playing: if a PAST manual scrub
  // or a completed play run has left hourOffset sitting behind minHourOffset
  // (real time has simply moved on since), nudge it forward to the new
  // floor rather than silently leaving the slider pointed at an hour that no
  // longer has genuine data behind it (see minHourOffset's own doc comment).
  useEffect(() => {
    if (mode === 'hourly' && hourOffset < minHourOffset) {
      setHourOffset(minHourOffset);
    }
  }, [hourOffset, minHourOffset, mode]);

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
  // NOTE (2026-09-23, "select district, mouse-over temp data doesn't change
  // as the hourly slider moves"): every branch below pins hour/minute/second
  // to fixed values, but dayjs's `.hour()/.minute()/.second()` setters (like
  // native Date#setHours/setMinutes/setSeconds) leave the MILLISECOND
  // component untouched - it stays whatever `dayjs()`/`now` happened to carry
  // at the exact instant this line ran. `at` feeds `useDebouncedValue` and
  // RTK Query's cache key (LiveMapPage.tsx), both of which key off the exact
  // string, so without `.millisecond(0)` this hook returned a DIFFERENT `at`
  // string on every single render (mouse move, playback tick, any parent
  // re-render) even while `hourOffset` itself hadn't changed. That constant
  // jitter kept re-arming useDebouncedValue's 400ms timer before it could
  // ever fire, which pinned `debouncedAt` (and so every district/state's
  // avgValue - see districtRisk.ts's buildDistrictRiskIndex) on whatever hour
  // happened to be current the one time the timer did manage to settle -
  // while `displayAt` (read directly off `hourOffset`, no debounce) kept
  // advancing normally. That's exactly the reported symptom: the tooltip's
  // "As likely of <time>" label advances but its Temperature/Risk level
  // reading never does. It also independently explains why so many
  // network requests kept firing even after the debounce fix (confirmed
  // 2026-09-24 via a HAR capture) - a "settled" value that keeps changing by
  // a few milliseconds still counts as a new value to debounce/RTK Query.
  // `.millisecond(0)` makes `at` byte-identical across renders for the same
  // (mode, dayOffset, hourOffset) - the debounce can now actually debounce,
  // and cache keys stay stable until the user's selection genuinely changes.
  const at =
    mode === 'daily'
      ? dayOffset === 0
        ? now.toISOString()
        : selectedDate.hour(12).minute(0).second(0).millisecond(0).toISOString()
      : dayjs().add(selectedHour.dayIndex, 'day').hour(hourOfDay).minute(0).second(0).millisecond(0).toISOString();

  // DISPLAY-only hour for the map's "As of <date>, <time>" tooltip line -
  // added 2026-09-23 per explicit request ("current time 3:54 remove
  // current and show next hour like 4, then current time is 4:30 then show
  // 5:00"). Only the live "Today" case (`at` above ticks to the exact
  // current minute every 60s - see the big comment on `now`) needs this:
  // every other case (a scrubbed hour, or a future daily-outlook day) is
  // already pinned to the top of an hour with :00 minutes, so there is
  // nothing to round there. This does NOT change `at` itself - the actual
  // observations query (`useGetObservationsAtTimeQuery({ at })` in
  // LiveMapPage.tsx) still asks for the real live instant, and the backend
  // still resolves that to whichever real hourly row is latest-at-or-before
  // it (see IndusWeatherService/`findLatestAtOrBefore`) - so what data gets
  // shown is unaffected. Only the LABEL rounds forward to the next clean
  // hour (15:54 -> 16:00, 16:30 -> 17:00), since this app's real data
  // granularity is hourly and a live-ticking minute in the "As of" line
  // read as false precision the underlying reading doesn't actually have.
  // Exactly on the hour (minute and second both 0) stays put rather than
  // jumping an extra hour forward.
  // With 'daily' mode disabled (see the 'hourly' default above), this
  // branch is now dormant - `at` in 'hourly' mode is already pinned to a
  // clean top-of-hour value (hourOffset only changes on the hour, via the
  // live-follow effect above), so displayAt === at in every reachable case
  // today. Left as-is (harmless) so 'daily' mode's own live-rounding still
  // works correctly if it's ever re-enabled.
  const displayAt =
    mode === 'daily' && dayOffset === 0
      ? (now.minute() === 0 && now.second() === 0 ? now : now.add(1, 'hour').startOf('hour')).toISOString()
      : at;

  return {
    mode,
    setMode: changeMode,
    days,
    dayOffset,
    setDayOffset,
    hours,
    hourOffset,
    setHourOffset: changeHourOffset,
    // Earliest hourly position with genuine (non-fallback) data behind it -
    // see this hook's own doc comment on `minHourOffset` above. TimelineScrubber
    // uses this as the hourly Slider's `min` so the UI can't be dragged into
    // the no-real-data stretch of today in the first place.
    minHourOffset,
    playing,
    togglePlaying,
    speed,
    setSpeed,
    at,
    displayAt,
    isToday: mode === 'daily' ? dayOffset === 0 : selectedHour.dayIndex === 0,
    resetToLive,
    // See `holdPlayback`'s own doc comment above - LiveMapPage calls
    // `setHoldPlayback` from an effect keyed on its own `processingLabel`
    // (the exact signal that decides whether the ProcessingOverlay popup is
    // showing), so the slider freezes/resumes in lockstep with that popup.
    holdPlayback,
    setHoldPlayback,
  };
}
