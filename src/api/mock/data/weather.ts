import dayjs from 'dayjs';
import { getSiteById } from './sites';
import { hashStringToSeed, seededRandom, randomInRange, pick } from '../rng';
import type { CurrentObservation, ForecastDay, HistoricalPoint, WeatherCondition } from '@/features/weather/types';

const CONDITIONS: WeatherCondition[] = ['clear', 'partly-cloudy', 'cloudy', 'rain', 'thunderstorm', 'fog', 'windy'];

/** Base temperature (deg C) skewed by latitude: sites nearer the equator run warmer. */
function baseTemperatureFor(siteId: string): number {
  const site = getSiteById(siteId);
  if (!site) return 27;
  const latitudeFactor = Math.max(0, 30 - Math.abs(site.latitude)); // 0..30
  return 22 + latitudeFactor * 0.35; // roughly 22-32 base
}

/** Is `date` within the Indian monsoon window (June - September)? */
function isMonsoonSeason(date: dayjs.Dayjs): boolean {
  const month = date.month() + 1; // 1-12
  return month >= 6 && month <= 9;
}

/**
 * Deterministic per-(state, hour) decision of whether that state is
 * simulated to be having a "severe" weather event this hour - a demo-only
 * enhancement, not a real forecast signal. Without this, the plain model
 * below only ever pushes low-latitude states (Kerala, Tamil Nadu, ...) into
 * the map's alert/warning colors, since `baseTemperatureFor` is a pure
 * latitude curve and nothing else in the model can cross the higher
 * severity bands (rainfall/wind are capped well under their own "warning"
 * thresholds - see severity.ts's BANDS) - so the Live Map's default
 * Temperature layer would show the same one or two southern states in
 * red/orange every single hour, and everywhere else permanently green.
 *
 * With this, roughly 3 in 10 states are "severe" in any given hour,
 * independent of latitude, and which ones rotates as the timeline's hourly
 * slider moves (a different hash per hour) - so scrubbing through hours
 * visibly moves alert/warning coloring around the whole map, not just
 * within whichever state happens to run warmest.
 */
function isSevereHour(state: string, at: dayjs.Dayjs): boolean {
  const seed = hashStringToSeed(`severe-state-${state}-${at.format('YYYY-MM-DD-HH')}`);
  return seededRandom(seed)() < 0.3;
}

function conditionFromRainfall(rainfall: number, windSpeed: number, rand: () => number): WeatherCondition {
  if (rainfall > 12) return 'thunderstorm';
  if (rainfall > 2) return 'rain';
  if (windSpeed > 35) return 'windy';
  return pick(rand, ['clear', 'partly-cloudy', 'cloudy', 'clear', 'fog'] as WeatherCondition[]);
}

export function generateObservationAt(siteId: string, at: dayjs.Dayjs): CurrentObservation {
  const seed = hashStringToSeed(`${siteId}-${at.format('YYYY-MM-DD-HH')}`);
  const rand = seededRandom(seed);
  const base = baseTemperatureFor(siteId);
  const site = getSiteById(siteId);
  const severe = site ? isSevereHour(site.state, at) : false;

  const hour = at.hour();
  const dailyCycle = Math.sin(((hour - 6) / 24) * Math.PI * 2) * 5; // peak mid-afternoon
  // Severe hours add a further heat spike on top of the ordinary latitude
  // curve, so a state well north of the equator can still cross into the
  // Temperature layer's alert/warning bands during its "severe" hours -
  // see isSevereHour's comment for why this exists.
  const severeHeatBoost = severe ? randomInRange(rand, 6, 14) : 0;
  const temperature = base + dailyCycle + randomInRange(rand, -1.5, 1.5) + severeHeatBoost;

  const monsoon = isMonsoonSeason(at);
  const rainChance = severe ? 0.85 : monsoon ? 0.55 : 0.12;
  const isRaining = rand() < rainChance;
  // Ordinary rain is capped well under rainfall's own "warning" threshold
  // (>=40mm/hr, see severity.ts's BANDS) - a severe hour's rain reaches into
  // both the alert (20-39) and warning (>=40) bands instead.
  const rainfallLastHour = isRaining
    ? severe
      ? randomInRange(rand, 22, 68)
      : randomInRange(rand, 0.5, monsoon ? 28 : 10)
    : 0;
  const rainfallToday = rainfallLastHour * randomInRange(rand, 1.5, 4.5);

  // Ordinary wind similarly never reaches windSpeed's "warning" threshold
  // (>=60 km/h) even in monsoon; a severe hour's wind spans alert and
  // warning both.
  const windSpeed = severe
    ? randomInRange(rand, 38, 78)
    : randomInRange(rand, 4, monsoon ? 45 : 28);
  const windGust = windSpeed + randomInRange(rand, 2, 18);
  const humidity = severe
    ? randomInRange(rand, 80, 99)
    : monsoon
      ? randomInRange(rand, 65, 95)
      : randomInRange(rand, 30, 70);
  const pressure = severe ? randomInRange(rand, 985, 1005) : randomInRange(rand, 1000, 1018);
  const lightning =
    isRaining && (severe || rand() > 0.5) ? Math.round(randomInRange(rand, severe ? 5 : 1, severe ? 60 : 40)) : 0;

  return {
    siteId,
    timestamp: at.toISOString(),
    temperature: Number(temperature.toFixed(1)),
    feelsLike: Number((temperature + randomInRange(rand, -1, 3)).toFixed(1)),
    humidity: Number(humidity.toFixed(0)),
    rainfallLastHour: Number(rainfallLastHour.toFixed(1)),
    rainfallToday: Number(rainfallToday.toFixed(1)),
    windSpeed: Number(windSpeed.toFixed(1)),
    windGust: Number(windGust.toFixed(1)),
    windDirection: Math.round(randomInRange(rand, 0, 359)),
    pressure: Number(pressure.toFixed(0)),
    lightningStrikesLastHour: lightning,
    condition: conditionFromRainfall(rainfallLastHour, windSpeed, rand),
    visibilityKm: Number(randomInRange(rand, severe ? 0.3 : isRaining ? 1 : 5, severe ? 3 : 12).toFixed(1)),
  };
}

export function getCurrentObservation(siteId: string): CurrentObservation {
  return generateObservationAt(siteId, dayjs());
}

export function getHistoricalSeries(
  siteId: string,
  from: string,
  to: string,
  interval: 'hourly' | 'daily' = 'hourly'
): HistoricalPoint[] {
  const start = dayjs(from);
  const end = dayjs(to);
  const stepUnit = interval === 'hourly' ? 'hour' : 'day';
  const stepAmount = 1;
  const points: HistoricalPoint[] = [];

  let cursor = start;
  let guard = 0;
  while ((cursor.isBefore(end) || cursor.isSame(end)) && guard < 2000) {
    const obs = generateObservationAt(siteId, cursor);
    points.push({
      timestamp: obs.timestamp,
      temperature: obs.temperature,
      humidity: obs.humidity,
      rainfall: obs.rainfallLastHour,
      windSpeed: obs.windSpeed,
      pressure: obs.pressure,
      lightningStrikes: obs.lightningStrikesLastHour,
    });
    cursor = cursor.add(stepAmount, stepUnit);
    guard += 1;
  }
  return points;
}

function forecastDay(siteId: string, date: dayjs.Dayjs, seedKey: string): ForecastDay {
  const seed = hashStringToSeed(`${siteId}-forecast-${seedKey}`);
  const rand = seededRandom(seed);
  const base = baseTemperatureFor(siteId);
  const monsoon = isMonsoonSeason(date);
  const minTemp = base - randomInRange(rand, 3, 6);
  const maxTemp = base + randomInRange(rand, 3, 7);
  const rainfallProbability = Math.round(monsoon ? randomInRange(rand, 40, 90) : randomInRange(rand, 5, 35));
  const expectedRainfallMm = rainfallProbability > 50 ? randomInRange(rand, 5, 60) : randomInRange(rand, 0, 4);
  const windSpeed = randomInRange(rand, 6, monsoon ? 38 : 22);
  const condition = conditionFromRainfall(expectedRainfallMm, windSpeed, rand);

  return {
    date: date.format('YYYY-MM-DD'),
    minTemp: Number(minTemp.toFixed(1)),
    maxTemp: Number(maxTemp.toFixed(1)),
    rainfallProbability,
    expectedRainfallMm: Number(expectedRainfallMm.toFixed(1)),
    windSpeed: Number(windSpeed.toFixed(1)),
    condition,
    summary: summaryFor(condition, rainfallProbability),
  };
}

export function getForecast(siteId: string, days = 7): ForecastDay[] {
  const result: ForecastDay[] = [];
  for (let i = 0; i < days; i += 1) {
    const date = dayjs().add(i, 'day');
    result.push(forecastDay(siteId, date, date.format('YYYY-MM-DD')));
  }
  return result;
}

/**
 * Same synthetic model as `getForecast`, but lets the caller pin the
 * "as-of" day the run was issued on, independent of today's real date.
 * Two calls for the same `targetDate` but different `issuedDate` values
 * deterministically diverge - modeling how a forecast model's output for a
 * given day changes as new runs come in on approach to that day. Mirrors
 * the backend's `WeatherGenerator.forecastAsOf` (see DeviationService)
 * and is what src/api/mock/data/deviations.ts diffs successive runs with.
 */
export function forecastAsOf(siteId: string, targetDate: dayjs.Dayjs, issuedDate: dayjs.Dayjs): ForecastDay {
  const targetKey = targetDate.format('YYYY-MM-DD');
  const issuedKey = issuedDate.format('YYYY-MM-DD');
  return forecastDay(siteId, targetDate, `${targetKey}-asof-${issuedKey}`);
}

function summaryFor(condition: WeatherCondition, rainfallProbability: number): string {
  switch (condition) {
    case 'thunderstorm':
      return `Thunderstorms likely, ${rainfallProbability}% chance of rain`;
    case 'rain':
      return `Rain expected, ${rainfallProbability}% chance`;
    case 'windy':
      return 'Strong winds expected';
    case 'fog':
      return 'Foggy conditions in the morning';
    case 'cloudy':
      return 'Overcast through the day';
    case 'partly-cloudy':
      return 'Partly cloudy skies';
    default:
      return 'Clear skies expected';
  }
}

export { CONDITIONS };
