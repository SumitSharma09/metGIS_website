import type { CurrentObservation } from '@/features/weather/types';

/**
 * True when `obs` looks like a real hourly_weather-backed reading rather
 * than the backend's zero-filled placeholder for a tower with no ingested
 * rows yet (temperature=0 AND humidity=0 AND condition="clear", all at
 * once - a combination that essentially never occurs in a real Indian
 * hourly reading). See IndusWeatherService.emptyCurrentObservation() on
 * the backend, and DashboardService's own copy of this same heuristic -
 * kept in sync manually since frontend/backend don't share code.
 * <p>
 * Used anywhere a weather value is rendered as a table cell, card stat, or
 * chart point, so a tower with no data yet shows "Not currently available"
 * (see the NotAvailable component) instead of a misleading 0.0/0%/clear.
 */
export function hasRealReading(obs: CurrentObservation | null | undefined): boolean {
  if (!obs) return false;
  return !(obs.temperature === 0 && obs.humidity === 0 && obs.condition === 'clear');
}
