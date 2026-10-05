import { useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import { useGetSkymetForecastAllQuery } from '@/features/weather/weatherApi';
import { normalizeName, splitCircleStateName } from '@/utils/districtRisk';
import type { Site } from '@/features/sites/types';
import type { SkymetDistrictForecast, SkymetForecastDay } from '@/features/weather/types';

export interface SkymetDaySnapshot {
  /** 0-6, ZERO-based - 0 is "today", matching SkymetForecastDay.daySequence. */
  offset: number;
  /** A real calendar-day ISO instant for this offset, computed the same way
   *  regardless of whether any Skymet data actually matched (dayjs().add(offset,
   *  'day')) - so date-based alignment (e.g. buildCycloneHazardRow's own
   *  cyclone-track lookup) always works even for an offset with no Skymet
   *  coverage yet, exactly like useSevenDayObservations's own `at` field. */
  at: string;
  /** The real ISO date Skymet itself reports for this day, when at least
   *  one site matched - null if nothing matched (see `at` above for the
   *  always-available calendar-day equivalent). */
  date: string | null;
  label: string;
  /** Every site whose (district, state) matched a Skymet row gets that
   *  SAME district-level SkymetForecastDay object here - by design: Skymet
   *  is a real per-DISTRICT vendor feed, not per-tower, so every tower in a
   *  district shares its one outlook rather than getting an individual
   *  figure that doesn't exist in the source data. */
  bySiteId: Record<string, SkymetForecastDay>;
}

const DAY_LABELS = ['Today', 'Tomorrow'];

function dayLabel(offset: number, weekday?: string): string {
  return DAY_LABELS[offset] ?? weekday ?? dayjs().add(offset, 'day').format('ddd D MMM');
}

/**
 * Real per-district 7-day Skymet outlook (skymet_7daysforecast_data via
 * GET /weather/forecast/skymet/all), matched to every SITE and shaped into
 * 7 fixed day snapshots - the shared data source behind the Reports page's
 * Tower Risk forecast table and both Daily Bulletins (National/Circle), and
 * the Alerts page's forecast-alert feed. Added 2026-09-22 to replace those
 * pages' old hourly-derived 7-day figures (useSevenDayObservations /
 * useSevenDayForecastTotals) per an explicit request: "alerts section,
 * reports sections(tower risk,daily national bulletin and circle bulletin)
 * all works on 7 days forecast table not hourly wise okay. please change
 * this."
 * <p>
 * Every tower in a district shows that SAME district's Skymet outlook -
 * Skymet is a real per-district (not per-tower) vendor feed, so there is no
 * more granular "this one tower's" forecast to show. This matches the
 * choice already made for the Live Map's own district panel (see
 * SkymetForecastService's own averaging of a district's multiple Skymet
 * locations into one figure) and the explicit answer given for this
 * migration's own scope ("Show district-level Skymet figures per tower").
 * <p>
 * Matching a site to a Skymet row: an earlier version of this doc comment
 * claimed Skymet's own `state` column holds a genuine, split government
 * state name (as opposed to `Site.state`, which in this app actually holds
 * the telecom CIRCLE value, e.g. "Bihar & Jharkhand" - see districtRisk.ts's
 * own comment) - that claim was WRONG, and caused a real bug fixed
 * 2026-09-22 after a report that Tower Risk showed "N/A" for Rainfall/
 * Temperature/Wind Speed/Snowfall/Avalanche in every district of a combined
 * circle (confirmed directly: {@code SELECT district, state FROM
 * skymet_7daysforecast_data WHERE district LIKE 'PATNA'} returned
 * {@code state = "Bihar & Jharkhand"} - the raw CIRCLE string, unsplit, not
 * "Bihar"). Skymet's own ingestion evidently reuses this app's own circle
 * taxonomy for its `state` column, not real split government-state names -
 * the same conclusion the Live Map's per-district panel already relied on
 * correctly (it passes the raw, unsplit circle value straight through and
 * has worked since the Ramban example earlier this session). So the primary
 * match is now the site's raw, UNSPLIT `site.state` against the Skymet
 * index - `splitCircleStateName` (the Live Map choropleth's own circle-
 * splitting helper) is tried only as a defensive SECOND attempt, in case a
 * future district genuinely needs it; every real case confirmed so far
 * (Ramban/J&K, Patna/Bihar) matches on the raw value alone, and splitting
 * first is exactly what broke Bihar, Jharkhand, Madhya Pradesh,
 * Chhattisgarh, Jammu and Kashmir and Ladakh - every district in this
 * app's 3 combined circles - until now.
 * <p>
 * Only parameters Skymet genuinely reports (max/min temperature, rainfall
 * amount + chance, wind speed + direction) are exposed via `bySiteId` -
 * Humidity, Visibility, Lightning, Flood and Fog have no Skymet column at
 * all (confirmed against the vendor's own data dictionary) and are
 * deliberately NOT synthesized here. A caller needing those still uses
 * useSevenDayObservations for them, so a table never mixes one honestly
 * real Skymet figure with a fabricated stand-in for another parameter this
 * feed simply doesn't have.
 */
export function useSkymetSevenDayForecast(sites: Site[]) {
  const { data: districts = [], isLoading } = useGetSkymetForecastAllQuery();

  const index = useMemo(() => {
    const map = new Map<string, SkymetDistrictForecast>();
    districts.forEach((d) => {
      map.set(`${normalizeName(d.district)}|${normalizeName(d.state)}`, d);
    });
    return map;
  }, [districts]);

  const forecastForSite = useMemo(() => {
    const cache = new Map<string, SkymetDistrictForecast | undefined>();
    return (site: Site): SkymetDistrictForecast | undefined => {
      const cacheKey = `${site.district}|${site.state}`;
      if (cache.has(cacheKey)) return cache.get(cacheKey);
      // Try the site's raw, UNSPLIT state (circle) value FIRST - confirmed
      // 2026-09-22 (see this hook's own doc comment) that Skymet's own
      // `state` column actually stores this same raw circle string, not a
      // split government-state name. Only fall back to the split candidate
      // state(s) if that raw match fails, as a defensive second attempt -
      // not something any confirmed real district has actually needed.
      const rawHit = index.get(`${normalizeName(site.district)}|${normalizeName(site.state)}`);
      const hit =
        rawHit ??
        splitCircleStateName(site.state)
          .map((st) => index.get(`${normalizeName(site.district)}|${normalizeName(st)}`))
          .find((v): v is SkymetDistrictForecast => Boolean(v));
      cache.set(cacheKey, hit);
      return hit;
    };
  }, [index]);

  // Dev-only diagnostics, mirroring DistrictLayer.tsx's own "which district
  // never matched a polygon" console warning - added 2026-09-22 while
  // tracking down the "N/A everywhere in Tower Risk" report, which turned
  // out to be the raw-vs-split circle/state bug fixed just above (confirmed
  // via a real `SELECT ... WHERE district LIKE 'PATNA'` showing Skymet's own
  // `state` column holds the raw circle string). Left in place (not just a
  // one-off debugging aid) as an ongoing sanity check: if a district still
  // shows "N/A" after this fix, these logs distinguish the two ways that can
  // still happen -
  //  (1) DISTRICT/STATE NAME MISMATCH - neither the raw circle value nor any
  //      split government-state name matches any Skymet row for that
  //      district at all (e.g. a genuine spelling difference, the same class
  //      of issue already fixed once for "Leh Ladakh" vs "Leh (ladakh)").
  //  (2) DATE MISMATCH - the district matched a real Skymet forecast, but
  //      none of its 7 rows' own `date` values landed on any of the 7 target
  //      calendar days being requested - would point at a date-format/
  //      timezone disagreement, not a naming problem.
  useEffect(() => {
    if (!import.meta.env.DEV || sites.length === 0 || isLoading) return;
    // eslint-disable-next-line no-console
    console.info(
      `[useSkymetSevenDayForecast] Skymet feed returned ${districts.length} distinct district/state group(s) for ${sites.length} site(s) in scope.`
    );
    const seen = new Set<string>();
    const unmatched: string[] = [];
    let firstMatch: { site: Site; forecast: SkymetDistrictForecast } | null = null;
    sites.forEach((site) => {
      const key = `${site.district}|${site.state}`;
      if (seen.has(key)) return;
      seen.add(key);
      const hit = forecastForSite(site);
      if (hit) {
        if (!firstMatch) firstMatch = { site, forecast: hit };
      } else {
        unmatched.push(
          `district="${site.district}" tried raw state(circle)="${site.state}" and split government-state(s)=[${splitCircleStateName(site.state).join(', ')}]`
        );
      }
    });
    if (unmatched.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[useSkymetSevenDayForecast] ${unmatched.length} of ${seen.size} distinct (district, state) pair(s) among these sites never matched ANY Skymet row (tried both the raw circle value and its split government-state name(s)) - those districts will show "N/A" for Rainfall/Temperature/Wind Speed/Snowfall/Avalanche. Likely a genuine spelling mismatch between indus_locations and skymet_7daysforecast_data (the same kind of issue already fixed once for Leh Ladakh) - report the exact strings below back so the right alias can be added:\n` +
          unmatched.slice(0, 15).join('\n') +
          (unmatched.length > 15 ? `\n...and ${unmatched.length - 15} more` : '')
      );
    }
    if (firstMatch) {
      const { site, forecast } = firstMatch as { site: Site; forecast: SkymetDistrictForecast };
      const targetDates = Array.from({ length: 7 }, (_, o) => dayjs().add(o, 'day').format('YYYY-MM-DD'));
      // eslint-disable-next-line no-console
      console.info(
        `[useSkymetSevenDayForecast] Example match: site district="${site.district}" matched Skymet district="${forecast.district}", state="${forecast.state}" with ${forecast.days.length} day-row(s) dated [${forecast.days.map((d) => d.date).join(', ')}]. Requesting these 7 calendar days: [${targetDates.join(', ')}].`
      );
    }
  }, [sites, forecastForSite, districts.length, isLoading]);

  const days: SkymetDaySnapshot[] = useMemo(() => {
    return Array.from({ length: 7 }, (_, offset) => {
      const bySiteId: Record<string, SkymetForecastDay> = {};
      let date: string | null = null;
      let weekday: string | undefined;
      const targetDate = dayjs().add(offset, 'day');
      sites.forEach((site) => {
        const forecast = forecastForSite(site);
        // Matched by the row's own real calendar `date`, not by trusting
        // `daySequence === offset` blindly - fixed 2026-09-22 alongside the
        // same bug on the Live Map's district panel (a card labeled
        // "Tomorrow" that showed today's real date): if the Skymet feed
        // hasn't been re-ingested yet today, sequence 0's real date is
        // still yesterday's, and matching on sequence alone would silently
        // show yesterday's figures as "today"'s. Matching on the real date
        // instead means a not-yet-refreshed offset just has no match (falls
        // through to bySiteId being empty for it) rather than showing stale
        // data under the wrong day - honest either way, and once the feed
        // catches up this produces the exact same result as before.
        const day = forecast?.days.find((d) => dayjs(d.date).isSame(targetDate, 'day'));
        if (day) {
          bySiteId[site.id] = day;
          if (date === null) {
            date = day.date;
            weekday = day.weekday;
          }
        }
      });
      return {
        offset,
        at: dayjs().add(offset, 'day').toISOString(),
        date,
        label: dayLabel(offset, weekday),
        bySiteId,
      };
    });
  }, [sites, forecastForSite]);

  return {
    isLoading,
    days,
    forecastForSite,
  };
}
