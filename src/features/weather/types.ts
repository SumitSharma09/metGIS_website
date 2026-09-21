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
