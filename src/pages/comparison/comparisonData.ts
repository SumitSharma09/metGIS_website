import dayjs from 'dayjs';
import { generateObservationAt } from '@/api/mock/data/weather';
import { hashStringToSeed, seededRandom, randomInRange } from '@/api/mock/rng';

/**
 * One matched forecast-vs-actual day for one DISTRICT - the district-level
 * successor to the old per-SITE row shape (which compared against
 * `hourly_weather`/`actual_hourly_weather`). Mirrors the backend's
 * `DistrictComparisonDto` exactly (see
 * `com.weatherops.backend.indus.IndusDistrictComparisonService`) so the real
 * endpoint and this mock generator are interchangeable from every
 * component's point of view.
 *
 * Covers exactly the four parameters the user asked the Comparison page to
 * compare: max temperature, min temperature, rainfall and wind speed -
 * deliberately not humidity/visibility/etc., since neither of the user's
 * real source tables (`indus_districts_actual_gtsData`,
 * `skymet_save_forecast_data`) reports those.
 */
/**
 * Every forecast/actual/accuracy field is `number | null`, not a plain
 * `number` (fixed 2026-09-23, real bug - "in comparioson section they are
 * not compare the data"): a real ground-truth row from the user's own
 * `indus_districts_actual_gtsData` table can genuinely have no MaxTemp
 * and/or no Rainfall reading for a given station/day (confirmed directly by
 * the user via a live `SELECT` - those columns come back NULL), while the
 * matching Skymet forecast side has a real number. The backend now sends
 * `null` for a value it has no real reading for (see
 * `DistrictComparisonDto`'s own doc comment on the backend) instead of
 * fabricating a `0`, which used to be silently indistinguishable from a
 * genuine zero reading - exactly the kind of invented figure this app's
 * "never fabricate/mismatch data" rule exists to prevent. Every component
 * reading these fields (AccuracyKpis, AccuracyTrendChart, ComparisonGrid,
 * comparisonExport) treats `null` as "N/A", never as zero.
 */
export interface ComparisonRow {
  date: string; // YYYY-MM-DD
  district: string;
  state: string;
  forecastMaxTemp: number | null;
  actualMaxTemp: number | null;
  forecastMinTemp: number | null;
  actualMinTemp: number | null;
  forecastRainfall: number | null;
  actualRainfall: number | null;
  forecastWindSpeed: number | null;
  actualWindSpeed: number | null;
  accuracyPct: number | null; // 0-100, blended across whichever parameters had both sides available; null if none did
}

/**
 * One representative site per district - just enough identity for the
 * seeded mock generator below to derive a believable daily reading from the
 * existing `generateObservationAt` model. The real backend has no such
 * per-site requirement (see `IndusDistrictComparisonService`, which averages
 * every real GTS station actually reporting for that district/day instead).
 */
export interface DistrictSeed {
  siteId: string;
  district: string;
  state: string;
}

// Four samples/day (roughly every 6 hours) is enough for a believable
// max/min spread and a plausible rainfall/wind total in mock mode, without
// generating and discarding a full 24-hour series per district/day.
const SAMPLE_HOURS = [2, 8, 14, 20];

// Same accuracy-formula convention as the real backend's
// IndusDistrictComparisonService (temp factor 8.0, rainfall factor 4.0, wind
// factor 3.0) - not a formula from any external standard, just kept
// identical here so mock and real modes read the same way to a user
// comparing screenshots.
const TEMP_ACCURACY_FACTOR = 8.0;
const RAINFALL_ACCURACY_FACTOR = 4.0;
const WIND_ACCURACY_FACTOR = 3.0;

function accuracy(actual: number, forecast: number, factor: number): number {
  return Math.max(0, 100 - Math.abs(actual - forecast) * factor);
}

/**
 * Blended accuracy across exactly the three parameters the Comparison page
 * covers - max temp, min temp and rainfall (wind speed dropped from the page
 * per explicit request, 2026-09-24: "i compare the max min temp and
 * rainfall only"). The row's own `accuracyPct` field (above, and as sent by
 * the real backend/this mock generator) is still blended across all 4
 * parameters including wind, so the UI no longer reads it directly - this
 * recomputes the headline accuracy figure client-side from the same real
 * forecast/actual pairs, using the identical per-parameter formula
 * (`accuracy()` above, same factors as `IndusDistrictComparisonService`), so
 * it reflects only the 3 parameters actually shown. Null-safe exactly like
 * `nullSafeMae` in AccuracyKpis.tsx: a parameter with no real reading on
 * either side that day is left out of the row's blend rather than treated as
 * a 0, and this returns `null` only when none of the 3 parameters had both a
 * real forecast and a real actual value for that row.
 */
export function accuracyForRow(row: ComparisonRow): number | null {
  const scores: number[] = [];
  if (row.forecastMaxTemp !== null && row.actualMaxTemp !== null) {
    scores.push(accuracy(row.actualMaxTemp, row.forecastMaxTemp, TEMP_ACCURACY_FACTOR));
  }
  if (row.forecastMinTemp !== null && row.actualMinTemp !== null) {
    scores.push(accuracy(row.actualMinTemp, row.forecastMinTemp, TEMP_ACCURACY_FACTOR));
  }
  if (row.forecastRainfall !== null && row.actualRainfall !== null) {
    scores.push(accuracy(row.actualRainfall, row.forecastRainfall, RAINFALL_ACCURACY_FACTOR));
  }
  return scores.length ? Number((scores.reduce((sum, v) => sum + v, 0) / scores.length).toFixed(1)) : null;
}

/**
 * Temperature-only accuracy (max + min blended), split out of
 * `accuracyForRow`'s 3-parameter blend so the new 3-card KPI row
 * (2026-09-25, matching the user's own reference design - page 10 of
 * "Scope Document for POC - Weather Partner") can show a dedicated
 * Temperature card alongside Overall and Rainfall, instead of one
 * headline gauge plus MAE tiles. Same null-safety rule as
 * `accuracyForRow`: a side with no real reading is left out of the
 * blend, never treated as a 0, and this returns `null` only when
 * neither max nor min temp had both a real forecast and a real actual
 * for this row.
 */
export function temperatureAccuracyForRow(row: ComparisonRow): number | null {
  const scores: number[] = [];
  if (row.forecastMaxTemp !== null && row.actualMaxTemp !== null) {
    scores.push(accuracy(row.actualMaxTemp, row.forecastMaxTemp, TEMP_ACCURACY_FACTOR));
  }
  if (row.forecastMinTemp !== null && row.actualMinTemp !== null) {
    scores.push(accuracy(row.actualMinTemp, row.forecastMinTemp, TEMP_ACCURACY_FACTOR));
  }
  return scores.length ? Number((scores.reduce((sum, v) => sum + v, 0) / scores.length).toFixed(1)) : null;
}

/**
 * Rainfall-only accuracy, split out of `accuracyForRow`'s 3-parameter
 * blend for the same reason as `temperatureAccuracyForRow` above - the
 * new 3-card KPI row needs a standalone Rainfall accuracy percentage,
 * not a rainfall MAE. Null-safe the same way: `null` only when this row
 * has no real forecast/actual rainfall pair.
 */
export function rainfallAccuracyForRow(row: ComparisonRow): number | null {
  return row.forecastRainfall !== null && row.actualRainfall !== null
    ? accuracy(row.actualRainfall, row.forecastRainfall, RAINFALL_ACCURACY_FACTOR)
    : null;
}

/**
 * Shared Forecast/Actual palette + accuracy severity scale (2026-09-25 full
 * Comparison-page redesign) - single source of truth so the KPI gauge, the
 * trend chart, and the data grid's column headers/accuracy chips all agree
 * on what each color means, instead of three components each defining their
 * own copy (which is exactly how they drifted into looking like three
 * separate designs in earlier rounds). Colors validated via the dataviz
 * skill's `scripts/validate_palette.js`: CVD-adjacent separation Delta-E
 * 21.1 and normal-vision Delta-E 23.0, both well clear of the >=8 safe
 * floor. Light-mode contrast for the teal against a light card surface comes
 * back WARN (2.95:1, below the 3:1 relief threshold) - resolved everywhere
 * these colors are used by always pairing the swatch with a visible text
 * label (a legend, a column header, a value), never color alone.
 */
export const FORECAST_COLOR = '#2563eb';
export const ACTUAL_COLOR = '#0ea5a4';

/** Same 85/65 thresholds this page has used since the original mock
 *  generator - not a formula from any external standard, just kept as the
 *  one place every accuracy-colored element (KPI gauge, grid chip) reads
 *  from now. */
export function accuracyColor(pct: number): 'success' | 'warning' | 'error' {
  if (pct >= 85) return 'success';
  if (pct >= 65) return 'warning';
  return 'error';
}

/**
 * Mock-mode only. There's no persisted archive of past forecasts to compare
 * against in the mock layer (like most weather APIs, it only forecasts
 * forward from "now"). To make the Comparison page meaningful without a
 * real forecast history, this derives a stable, deterministic "as
 * predicted" value for each past day/district/parameter from the same
 * seeded generator used everywhere else in the mock layer, offset by a
 * bounded pseudo-error that represents typical day-ahead forecast drift. It
 * reproduces identically across reloads.
 * <p>
 * The real backend does NOT use this - once `app.indus.enabled=true`, GET
 * /comparison/districts (see features/comparison/comparisonApi.ts) joins the
 * user's own real `indus_districts_actual_gtsData` (ground truth) and
 * `skymet_save_forecast_data` (same-day forecast archive) MySQL tables
 * instead (see IndusDistrictComparisonService on the backend). This
 * generator only still runs when VITE_USE_MOCK_API=true.
 */
export function buildComparisonRows(districtSeeds: DistrictSeed[], days = 7): ComparisonRow[] {
  const rows: ComparisonRow[] = [];

  for (let i = days; i >= 1; i -= 1) {
    const day = dayjs().subtract(i, 'day');
    for (const seed of districtSeeds) {
      const samples = SAMPLE_HOURS.map((h) => generateObservationAt(seed.siteId, day.hour(h).minute(0).second(0)));
      const actualMaxTemp = Number(Math.max(...samples.map((s) => s.temperature)).toFixed(1));
      const actualMinTemp = Number(Math.min(...samples.map((s) => s.temperature)).toFixed(1));
      const actualRainfall = Number(samples.reduce((sum, s) => sum + s.rainfallLastHour, 0).toFixed(1));
      const actualWindSpeed = Number(
        (samples.reduce((sum, s) => sum + s.windSpeed, 0) / samples.length).toFixed(1)
      );

      const rand = seededRandom(hashStringToSeed(`${seed.district}-forecast-drift-${day.format('YYYY-MM-DD')}`));
      const forecastMaxTemp = Number((actualMaxTemp + randomInRange(rand, -3, 3)).toFixed(1));
      const forecastMinTemp = Number((actualMinTemp + randomInRange(rand, -2, 2)).toFixed(1));
      const forecastRainfall = Number(Math.max(0, actualRainfall + randomInRange(rand, -6, 6)).toFixed(1));
      const forecastWindSpeed = Number(Math.max(0, actualWindSpeed + randomInRange(rand, -8, 8)).toFixed(1));

      const accuracyPct = Number(
        (
          (accuracy(actualMaxTemp, forecastMaxTemp, TEMP_ACCURACY_FACTOR) +
            accuracy(actualMinTemp, forecastMinTemp, TEMP_ACCURACY_FACTOR) +
            accuracy(actualRainfall, forecastRainfall, RAINFALL_ACCURACY_FACTOR) +
            accuracy(actualWindSpeed, forecastWindSpeed, WIND_ACCURACY_FACTOR)) /
          4
        ).toFixed(1)
      );

      rows.push({
        date: day.format('YYYY-MM-DD'),
        district: seed.district,
        state: seed.state,
        forecastMaxTemp,
        actualMaxTemp,
        forecastMinTemp,
        actualMinTemp,
        forecastRainfall,
        actualRainfall,
        forecastWindSpeed,
        actualWindSpeed,
        accuracyPct,
      });
    }
  }

  return rows;
}
