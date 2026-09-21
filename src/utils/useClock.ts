import { useEffect, useState } from 'react';
import dayjs from 'dayjs';

/** Ticking clock, re-rendered once a second. Used by the top nav's live clock
 *  and anywhere else a "current time" readout is shown. */
export function useClock(intervalMs = 1000) {
  const [now, setNow] = useState(() => dayjs());

  useEffect(() => {
    const id = window.setInterval(() => setNow(dayjs()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
