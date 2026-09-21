import dayjs from 'dayjs';
import { generateObservationAt } from '@/api/mock/data/weather';
import { hashStringToSeed, seededRandom, randomInRange } from '@/api/mock/rng';
import type { Site } from '@/features/sites/types';

export interface ComparisonRow {
  date: string; // YYYY-MM-DD
  siteId: string;
  siteName: string;
  forecastTemp: number;
  actualTemp: number;
  forecastRainfall: number;
  actualRainfall: number;
  accuracyPct: number; // 0-100, blended across temperature + rainfall
}

/**
 * Mock-mode only. There's no persisted archive of past forecasts to compare
 * against in the mock layer (like most weather APIs, it only forecasts
 * forward from "now"). To make the Comparison page meaningful without a
 * real forecast history, this derives a stable, deterministic "as
 * predicted" value for each past day from the same seeded generator used
 * everywhere else in the mock layer, offset by a bounded pseudo-error that
 * represents typical day-ahead forecast drift. It reproduces identically
 * across reloads.
 * <p>
 * The real backend does NOT use this - once `app.indus.enabled=true`, GET
 * /comparison (see features/comparison/comparisonApi.ts) joins the user's
 * own real `hourly_weather` (forecast) and `actual_hourly_weather` (ground
 * truth) MySQL tables instead (see IndusComparisonService on the backend).
 * This generator only still runs when VITE_USE_MOCK_API=true.
 */
export function buildComparisonRows(sites: Site[], days = 7): ComparisonRow[] {
  const rows: ComparisonRow[] = [];

  for (let i = days; i >= 1; i -= 1) {
    const date = dayjs().subtract(i, 'day').hour(12).minute(0).second(0);
    for (const site of sites) {
      const actual = generateObservationAt(site.id, date);
      const rand = seededRandom(hashStringToSeed(`${site.id}-forecast-drift-${date.format('YYYY-MM-DD')}`));
      const forecastTemp = Number((actual.temperature + randomInRange(rand, -3, 3)).toFixed(1));
      const forecastRainfall = Number(Math.max(0, actual.rainfallLastHour + randomInRange(rand, -6, 6)).toFixed(1));

      const tempError = Math.abs(forecastTemp - actual.temperature);
      const rainfallError = Math.abs(forecastRainfall - actual.rainfallLastHour);
      const tempAccuracy = Math.max(0, 100 - tempError * 8);
      const rainfallAccuracy = Math.max(0, 100 - rainfallError * 4);
      const accuracyPct = Number(((tempAccuracy + rainfallAccuracy) / 2).toFixed(1));

      rows.push({
        date: date.format('YYYY-MM-DD'),
        siteId: site.id,
        siteName: site.name,
        forecastTemp,
        actualTemp: actual.temperature,
        forecastRainfall,
        actualRainfall: actual.rainfallLastHour,
        accuracyPct,
      });
    }
  }

  return rows;
}
