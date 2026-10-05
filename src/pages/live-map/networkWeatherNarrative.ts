import type { CurrentObservation, WeatherCondition } from '@/features/weather/types';
import type { ForecastDaySnapshot } from '@/pages/reports/useSevenDayObservations';

/** Mean of a numeric field across a set of current observations - null (not
 *  0) when there's nothing to average yet, matching weatherNarrative.ts's
 *  averageOf but over live per-tower readings instead of one site's
 *  history. */
export function averageOfObservations(
  observations: CurrentObservation[],
  pick: (o: CurrentObservation) => number
): number | null {
  if (observations.length === 0) return null;
  return observations.reduce((sum, o) => sum + pick(o), 0) / observations.length;
}

/** Count of towers currently reporting fog, out of whichever towers have a
 *  live reading right now. */
export function fogTowerCount(observations: CurrentObservation[]): number {
  return observations.filter((o) => o.condition === 'fog').length;
}

export const CONDITION_LABEL: Record<WeatherCondition, string> = {
  clear: 'Clear',
  'partly-cloudy': 'Partly cloudy',
  cloudy: 'Cloudy',
  rain: 'Rain',
  thunderstorm: 'Thunderstorm',
  fog: 'Fog',
  windy: 'Windy',
};

function dominantCondition(observations: CurrentObservation[]): WeatherCondition | null {
  if (observations.length === 0) return null;
  const counts = new Map<WeatherCondition, number>();
  observations.forEach((o) => counts.set(o.condition, (counts.get(o.condition) ?? 0) + 1));
  let best = observations[0].condition;
  let bestCount = 0;
  counts.forEach((count, condition) => {
    if (count > bestCount) {
      best = condition;
      bestCount = count;
    }
  });
  return best;
}

export interface NetworkDaySummary {
  offset: number;
  label: string;
  towerCount: number;
  avgTemp: number | null;
  rainProbabilityPct: number | null;
  avgRainfallMm: number | null;
  dominantCondition: WeatherCondition | null;
  // avgWindSpeed/avgHumidity added 2026-09-24 to feed
  // NetworkWeatherPanel.tsx's TodayTomorrowHighlight card, per explicit
  // request ("add some more data like wind speed humidity rain etc") - same
  // averageOfObservations treatment as avgTemp/avgRainfallMm above, real
  // per-tower figures for this projected day, never invented.
  avgWindSpeed: number | null;
  avgHumidity: number | null;
}

/**
 * Turns one of useSevenDayObservations' daily snapshots (a reading per
 * tower, all taken at the same projected time) into network-wide figures:
 * the average projected temperature, the share of towers showing rain or a
 * thunderstorm that day, the average rainfall-so-far reading, and whichever
 * condition the most towers share. Everything here comes straight from the
 * same per-tower forecast data the Hazards page's weekly advisories already
 * fetch - nothing is invented to fill out a 7-day card.
 */
export function summarizeNetworkDay(day: ForecastDaySnapshot): NetworkDaySummary {
  const { observations } = day;
  const rainy = observations.filter((o) => o.condition === 'rain' || o.condition === 'thunderstorm');
  return {
    offset: day.offset,
    label: day.label,
    towerCount: observations.length,
    avgTemp: averageOfObservations(observations, (o) => o.temperature),
    rainProbabilityPct: observations.length > 0 ? (rainy.length / observations.length) * 100 : null,
    avgRainfallMm: averageOfObservations(observations, (o) => o.rainfallToday),
    dominantCondition: dominantCondition(observations),
    avgWindSpeed: averageOfObservations(observations, (o) => o.windSpeed),
    avgHumidity: averageOfObservations(observations, (o) => o.humidity),
  };
}

/**
 * A short, genuinely-derived nationwide outlook paragraph built from the
 * real 7-day tower-network snapshot - the network-wide counterpart to
 * weatherNarrative.ts's buildOutlookNarrative (which does the same thing
 * for one site's forecast).
 */
export function buildNetworkOutlookNarrative(days: ForecastDaySnapshot[]): string {
  const summaries = days.map(summarizeNetworkDay).filter((d) => d.towerCount > 0);
  if (summaries.length === 0) return '';

  const temps = summaries.map((d) => d.avgTemp).filter((t): t is number => t != null);
  if (temps.length === 0) return '';

  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);
  const peakRainDay = summaries.reduce((worst, d) =>
    (d.rainProbabilityPct ?? 0) > (worst.rainProbabilityPct ?? 0) ? d : worst
  );
  const towerCount = summaries[0].towerCount;

  return `Across ${towerCount} monitored towers over the next ${summaries.length} days, average daily temperatures range from ${Math.round(
    minTemp
  )}°C to ${Math.round(maxTemp)}°C. Rain is most likely on ${peakRainDay.label}, with about ${Math.round(
    peakRainDay.rainProbabilityPct ?? 0
  )}% of towers expecting rain or thunderstorms that day.`;
}
