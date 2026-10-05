export type WeatherCondition =
  | 'clear'
  | 'partly-cloudy'
  | 'cloudy'
  | 'rain'
  | 'thunderstorm'
  | 'fog'
  | 'windy';

export interface CurrentObservation {
  siteId: string;
  timestamp: string; // ISO datetime
  temperature: number; // deg C
  feelsLike: number;
  humidity: number; // %
  rainfallLastHour: number; // mm
  rainfallToday: number; // mm
  windSpeed: number; // km/h
  windGust: number; // km/h
  windDirection: number; // degrees 0-359
  pressure: number; // hPa
  lightningStrikesLastHour: number;
  condition: WeatherCondition;
  visibilityKm: number;
  // Real snowfall (cm), present only when the backend is sourcing this
  // observation from real Indus station data (see the backend's
  // IndusWeatherMapper) - undefined for the mock/demo generator, which
  // doesn't model snow. severity.ts's snowfall/avalanche risk functions use
  // this directly when it's present, falling back to their old
  // elevation-based proxy when it's not.
  snowfallCm?: number;
  // Real cloud cover % and rain probability %, present only when the
  // backend is sourcing this observation from real Indus station data (see
  // the backend's IndusWeatherMapper) - undefined for the mock/demo
  // generator, same pattern as snowfallCm above. Added 2026-09-18 for the
  // Live Map's per-district panel, which lists each of a district's
  // monitoring towers with its own real readings rather than one blended
  // district-wide average.
  cloudCoverPercent?: number;
  precipitationProbability?: number;
}

export interface HistoricalPoint {
  timestamp: string;
  temperature: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
  pressure: number;
  lightningStrikes: number;
  snowfallCm?: number; // see CurrentObservation.snowfallCm
}

export interface HistoricalQuery {
  siteId: string;
  from: string; // ISO date
  to: string; // ISO date
  interval?: 'hourly' | 'daily';
}

export interface ForecastDay {
  date: string; // ISO date
  minTemp: number;
  maxTemp: number;
  rainfallProbability: number; // %
  expectedRainfallMm: number;
  windSpeed: number;
  condition: WeatherCondition;
  summary: string;
}

export interface ForecastQuery {
  siteId: string;
  days?: number;
}

/** One site's forecast days - the per-site element of getForecastBatch's
 *  response, so many sites' forecasts can be fetched in one request instead
 *  of one GET /forecast/:siteId call per site. Wraps ForecastDay unchanged;
 *  see useSevenDayForecastTotals, which is what actually consumes this for
 *  the Reports bulletins' real daily rainfall-total/max-temperature rows. */
export interface SiteForecast {
  siteId: string;
  days: ForecastDay[];
}

/**
 * One day of a district's real Skymet 7-day outlook (GET
 * /weather/forecast/skymet) - a different, day-level-only data source from
 * everything else in this file, added 2026-09-22 specifically for the Live
 * Map's "7-Day Forecast Outlook" panel per an explicit request to show
 * max/min temp, rainfall + chance, wind speed + direction, cloud, and
 * sunrise/sunset as separate figures instead of one blended average, and to
 * source them from a real per-day vendor feed rather than sampling the
 * hourly data at one instant per day. Has nothing to do with the Live Map's
 * HOURLY timeline scrubber, which stays on CurrentObservation/hourly_weather
 * exactly as before.
 */
export interface SkymetForecastDay {
  daySequence: number; // 0-6, ZERO-based - 0 is always "today", 1 "tomorrow"
  date: string; // ISO date, e.g. "2026-09-22"
  weekday: string; // e.g. "Tuesday"
  description: string; // e.g. "Sunny"
  icon: string; // Skymet's own icon code, e.g. "sunny"
  raintext: string; // e.g. "No Rain"
  tempMaxC: number | null;
  tempMinC: number | null;
  rainfallMm: number | null;
  rainProbabilityPct: number | null;
  windSpeedKmh: number | null;
  windDirection: string | null; // short compass form, e.g. "SE"
  cloudPercent: number | null;
  sunrise: string | null; // "HH:mm", IST, e.g. "06:07"
  sunset: string | null; // "HH:mm", IST, e.g. "18:40"
}

export interface SkymetForecastQuery {
  district: string;
  state: string;
}

/**
 * One district's full 7-day Skymet outlook - the per-district element of
 * GET /weather/forecast/skymet/all's response (the bulk counterpart to
 * SkymetForecastQuery/SkymetForecastDay above). Added 2026-09-22 so the
 * Reports bulletins, Tower Risk table and Alerts page's forecast-alert feed
 * can fetch every district's outlook in one request instead of one
 * GET /weather/forecast/skymet per district - see
 * src/pages/reports/useSkymetSevenDayForecast.ts.
 * `state` is the real government state this row's own `state` column holds
 * (NOT a telecom circle - Site.state in this app actually IS a circle value,
 * see src/utils/districtRisk.ts's own comment), so matching this against a
 * Site needs splitCircleStateName(site.state) first.
 */
export interface SkymetDistrictForecast {
  district: string;
  state: string;
  days: SkymetForecastDay[];
}
