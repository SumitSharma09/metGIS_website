import { getParameterRisk, worseRisk, type RiskLevel } from '@/utils/severity';
import type { CurrentObservation } from '@/features/weather/types';
import type { WeatherParameter } from '@/utils/constants';

/** Parameters that feed a site's overall tower risk score (pressure and
 *  wind direction are informational only and don't drive the headline
 *  risk band). */
export const RISK_PARAMETERS: WeatherParameter[] = ['temperature', 'rainfall', 'windSpeed', 'humidity', 'lightning'];

export function readingFor(parameter: WeatherParameter, obs: CurrentObservation): number {
  switch (parameter) {
    case 'temperature':
      return obs.temperature;
    case 'rainfall':
      return obs.rainfallLastHour;
    case 'windSpeed':
      return obs.windSpeed;
    case 'humidity':
      return obs.humidity;
    case 'lightning':
      return obs.lightningStrikesLastHour;
    case 'pressure':
      return obs.pressure;
    default:
      return 0;
  }
}

/** A single site's overall risk = the worst risk band across the tracked
 *  parameters, at a single point in time. */
export function computeOverallRisk(obs: CurrentObservation): RiskLevel {
  return RISK_PARAMETERS.reduce<RiskLevel>(
    (acc, parameter) => worseRisk(acc, getParameterRisk(parameter, readingFor(parameter, obs))),
    'none'
  );
}
