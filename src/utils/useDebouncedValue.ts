import { useEffect, useState } from 'react';

/**
 * Returns `value`, but only updates to a new value after it has stopped
 * changing for `delayMs` - added 2026-09-24 to fix the Live Map's hourly
 * timeline scrubber flooding the network with weather requests.
 *
 * Root cause this fixes: MUI's `Slider` fires `onChange` continuously while
 * being dragged (once per pixel of mouse movement, not just on release), and
 * `useMapTimeline`'s playback timer also ticks `hourOffset` forward on its
 * own schedule. `LiveMapPage.tsx` used to feed that raw, rapidly-changing
 * `hourOffset`-derived `at` timestamp straight into
 * `useGetObservationsAtTimeQuery({ siteIds, at })` - and with no state/
 * district picked, that query asks for EVERY monitored tower nationwide
 * (tens of thousands of sites, multiple MB per response). A single drag
 * gesture across a handful of hours could fire hundreds of these huge
 * requests in a few seconds (confirmed 2026-09-24 via the browser's Network
 * tab: 402 requests, ~41 MB, 2.5 minutes to drain) - far more than the
 * browser's per-origin connection limit (~6 concurrent) can run at once, so
 * they queue up for minutes. Whatever finally rendered was just whichever
 * queued request happened to finish last, unrelated to wherever the slider
 * had since been dragged to - which is exactly why the map's "As likely of"
 * date/time label (driven directly by `hourOffset`, no network involved)
 * updated instantly while the actual temperature/humidity/etc. reading
 * appeared frozen or stuck on a stale hour.
 *
 * Debouncing the value passed into the network query (NOT the value used for
 * on-screen labels, which should stay instant) collapses a whole drag
 * gesture or a fast-forward playback run into a single request fired once
 * motion actually settles, instead of one request per intermediate step.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
