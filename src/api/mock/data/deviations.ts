import dayjs from 'dayjs';
import { sites } from './sites';
import { forecastAsOf } from './weather';
import type { DeviationAlert, DeviationParameter, DeviationSeverity } from '@/features/deviations/types';

/**
 * Deviation Alert Mechanism (scope doc section 2) - mock-mode mirror of the
 * backend's DeviationService. Issues a synthetic forecast "run" for each
 * site/day, compares it against the previous run for the same target day,
 * and raises a DeviationAlert wherever a headline figure (max temperature,
 * expected rainfall, wind speed) moved by more than that parameter's
 * threshold - e.g. "Rainfall forecast for Mumbai revised from 12mm to
 * 38mm". `forecastAsOf` (src/api/mock/data/weather.ts) is what makes two
 * runs for the same target day actually differ: it seeds by (site, target
 * day, issued day), so a later "as-of" day deterministically produces a
 * different but reproducible number.
 */

interface ForecastRunRecord {
  siteId: string;
  forecastDate: string; // ISO date
  issuedDate: string; // ISO date
  minTemp: number;
  maxTemp: number;
  expectedRainfallMm: number;
  windSpeed: number;
}

const LEAD_DAYS = 3;

const THRESHOLDS: Record<DeviationParameter, { minor: number; moderate: number; major: number }> = {
  temperature: { minor: 3, moderate: 5, major: 8 },
  rainfall: { minor: 8, moderate: 20, major: 40 },
  windSpeed: { minor: 10, moderate: 20, major: 35 },
};

const forecastRuns: ForecastRunRecord[] = [];
export const deviationAlerts: DeviationAlert[] = [];

function findRun(siteId: string, forecastDate: string, issuedDate: string): ForecastRunRecord | undefined {
  return forecastRuns.find((r) => r.siteId === siteId && r.forecastDate === forecastDate && r.issuedDate === issuedDate);
}

function findPreviousRun(siteId: string, forecastDate: string, beforeIssuedDate: string): ForecastRunRecord | undefined {
  return forecastRuns
    .filter((r) => r.siteId === siteId && r.forecastDate === forecastDate && r.issuedDate < beforeIssuedDate)
    .sort((a, b) => (a.issuedDate < b.issuedDate ? 1 : -1))[0];
}

function severityFor(delta: number, thresholds: { minor: number; moderate: number; major: number }): DeviationSeverity | null {
  if (delta >= thresholds.major) return 'major';
  if (delta >= thresholds.moderate) return 'moderate';
  if (delta >= thresholds.minor) return 'minor';
  return null;
}

function labelFor(parameter: DeviationParameter): { label: string; unit: string } {
  switch (parameter) {
    case 'temperature':
      return { label: 'Max temperature forecast', unit: '°C' };
    case 'rainfall':
      return { label: 'Rainfall forecast', unit: 'mm' };
    case 'windSpeed':
      return { label: 'Wind speed forecast', unit: 'km/h' };
  }
}

function compareRuns(siteName: string, previous: ForecastRunRecord, updated: ForecastRunRecord): DeviationAlert[] {
  const pairs: [DeviationParameter, number, number][] = [
    ['temperature', previous.maxTemp, updated.maxTemp],
    ['rainfall', previous.expectedRainfallMm, updated.expectedRainfallMm],
    ['windSpeed', previous.windSpeed, updated.windSpeed],
  ];

  const results: DeviationAlert[] = [];
  for (const [parameter, previousValue, updatedValue] of pairs) {
    const delta = Math.abs(updatedValue - previousValue);
    const severity = severityFor(delta, THRESHOLDS[parameter]);
    if (!severity) continue;
    const { label, unit } = labelFor(parameter);
    results.push({
      id: `dev-${updated.siteId}-${updated.forecastDate}-${parameter}-${updated.issuedDate}`,
      siteId: updated.siteId,
      siteName,
      forecastDate: updated.forecastDate,
      parameter,
      previousValue: Number(previousValue.toFixed(1)),
      updatedValue: Number(updatedValue.toFixed(1)),
      deltaAbsolute: Number(delta.toFixed(1)),
      severity,
      previousIssuedDate: previous.issuedDate,
      updatedIssuedDate: updated.issuedDate,
      detectedAt: dayjs().toISOString(),
      acknowledged: false,
      message: `${label} for ${siteName} (${updated.forecastDate}) revised from ${previousValue.toFixed(1)}${unit} to ${updatedValue.toFixed(1)}${unit}`,
    });
  }
  return results;
}

/** Issues runs for `issuedDate` (target days issuedDate+1..+LEAD_DAYS)
 *  across every site and returns any newly detected deviations. Used both
 *  to backfill history at module load and by the "Run deviation check"
 *  action on the Alerts page's Deviations tab. */
export function runDeviationCycleFor(issuedDate: dayjs.Dayjs): DeviationAlert[] {
  const issuedKey = issuedDate.format('YYYY-MM-DD');
  const newDeviations: DeviationAlert[] = [];

  for (const site of sites) {
    for (let lead = 1; lead <= LEAD_DAYS; lead += 1) {
      const targetDate = issuedDate.add(lead, 'day');
      const targetKey = targetDate.format('YYYY-MM-DD');
      if (findRun(site.id, targetKey, issuedKey)) continue; // already ran this combination

      const forecast = forecastAsOf(site.id, targetDate, issuedDate);
      const run: ForecastRunRecord = {
        siteId: site.id,
        forecastDate: targetKey,
        issuedDate: issuedKey,
        minTemp: forecast.minTemp,
        maxTemp: forecast.maxTemp,
        expectedRainfallMm: forecast.expectedRainfallMm,
        windSpeed: forecast.windSpeed,
      };
      forecastRuns.push(run);

      const previous = findPreviousRun(site.id, targetKey, issuedKey);
      if (previous) {
        newDeviations.push(...compareRuns(site.name, previous, run));
      }
    }
  }

  deviationAlerts.unshift(...newDeviations);
  return newDeviations;
}

export function runDeviationCycle(): DeviationAlert[] {
  return runDeviationCycleFor(dayjs());
}

export function acknowledgeDeviation(id: string): DeviationAlert | undefined {
  const alert = deviationAlerts.find((d) => d.id === id);
  if (alert) alert.acknowledged = true;
  return alert;
}

// Backfill three consecutive days of runs (today-2, today-1, today) at
// module load, mirroring the backend DataSeeder, so the feature has
// overlapping-target-date run pairs to diff from the very first page load
// instead of an empty tab until someone clicks "Run deviation check" for a
// few days running.
runDeviationCycleFor(dayjs().subtract(2, 'day'));
runDeviationCycleFor(dayjs().subtract(1, 'day'));
runDeviationCycleFor(dayjs());
