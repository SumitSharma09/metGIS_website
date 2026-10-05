import dayjs from 'dayjs';
import type { ForecastDay, HistoricalPoint, WeatherCondition } from '@/features/weather/types';

/** Mean of a numeric field across a set of historical readings - null (not
 *  0) when there's nothing to average yet, so callers can show a loading/
 *  placeholder state instead of a misleading "0". Callers with readings
 *  that span both day and night should bucket with `averageByPeriod`
 *  instead of calling this directly across the full set - see that
 *  function's doc comment for why. */
export function averageOf(points: HistoricalPoint[], pick: (p: HistoricalPoint) => number): number | null {
  if (points.length === 0) return null;
  return points.reduce((sum, p) => sum + pick(p), 0) / points.length;
}

export type PeriodOfDay = 'day' | 'night';

/** Which half of the clock an ISO timestamp falls in - 06:00-17:59 counts
 *  as daytime, 18:00-05:59 as nighttime. A fixed clock-hour split rather
 *  than a real per-site sunrise/sunset calculation - simple, and good
 *  enough for what this is guarding against (see `averageByPeriod`). */
export function periodOfDay(isoTimestamp: string): PeriodOfDay {
  const hour = dayjs(isoTimestamp).hour();
  return hour >= 6 && hour < 18 ? 'day' : 'night';
}

/**
 * Mean of a numeric field, bucketed into daytime and nighttime readings
 * first so the two are never blended into one figure - added 2026-09-22
 * per an explicit requirement that district/site temperature aggregation
 * must not average across hours with very different conditions (a 1-2 AM
 * low should never quietly pull down what reads as "the" temperature for
 * a tower or district). `WeatherDetailsPanel`'s old flat 24-hour average
 * over `history` (which spans a full day) was exactly that mistake at the
 * single-tower level - this replaces it. Each bucket is null (not 0) when
 * it has no readings yet, same convention as `averageOf`.
 */
export function averageByPeriod(
  points: HistoricalPoint[],
  pick: (p: HistoricalPoint) => number
): Record<PeriodOfDay, { value: number | null; count: number }> {
  const day = points.filter((p) => periodOfDay(p.timestamp) === 'day');
  const night = points.filter((p) => periodOfDay(p.timestamp) === 'night');
  return {
    day: { value: averageOf(day, pick), count: day.length },
    night: { value: averageOf(night, pick), count: night.length },
  };
}

const CONDITION_PHRASE: Record<WeatherCondition, string> = {
  clear: 'clear',
  'partly-cloudy': 'partly cloudy',
  cloudy: 'mostly cloudy',
  rain: 'rainy at times',
  thunderstorm: 'stormy at times',
  fog: 'foggy at times',
  windy: 'breezy at times',
};

function joinPhrases(phrases: string[]): string {
  if (phrases.length <= 1) return phrases[0] ?? 'variable';
  if (phrases.length === 2) return `${phrases[0]} and ${phrases[1]}`;
  return `${phrases.slice(0, -1).join(', ')}, and ${phrases[phrases.length - 1]}`;
}

/**
 * A short, genuinely-derived outlook paragraph built from the real N-day
 * forecast the app already has (via useGetForecastQuery) - not a fabricated
 * 15-day narrative. Labeled by the caller with however many days were
 * actually passed in, so the text never claims more than the data backs.
 */
export function buildOutlookNarrative(forecast: ForecastDay[]): string {
  if (forecast.length === 0) return '';
  const minTemp = Math.min(...forecast.map((d) => d.minTemp));
  const maxTemp = Math.max(...forecast.map((d) => d.maxTemp));
  const totalRain = forecast.reduce((sum, d) => sum + d.expectedRainfallMm, 0);
  const peakRainProb = Math.max(...forecast.map((d) => d.rainfallProbability));
  const conditions = Array.from(new Set(forecast.map((d) => d.condition)));
  const conditionText = joinPhrases(conditions.map((c) => CONDITION_PHRASE[c]));

  return `Over the next ${forecast.length} days, expect daily highs ranging from ${Math.round(minTemp)}°C to ${Math.round(
    maxTemp
  )}°C. Rainfall probability peaks at ${Math.round(peakRainProb)}%, with roughly ${Math.round(
    totalRain
  )} mm expected in total. Skies will be ${conditionText} through the period.`;
}

export function peakRainChance(forecast: ForecastDay[]): number | null {
  if (forecast.length === 0) return null;
  return Math.max(...forecast.map((d) => d.rainfallProbability));
}
