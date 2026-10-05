import { useMemo } from 'react';
import dayjs from 'dayjs';
import { useListSitesQuery } from '@/features/sites/sitesApi';
import { useSkymetSevenDayForecast } from '@/pages/reports/useSkymetSevenDayForecast';
import { getParameterRisk, getParameterThreshold, REPORT_RISK_LABEL, type RiskLevel } from '@/utils/severity';
import type { Site } from '@/features/sites/types';
import type { SkymetForecastDay } from '@/features/weather/types';
import type { ForecastAlertItem } from '@/features/alerts/types';
import type { AlertSeverity, WeatherParameter } from '@/utils/constants';

// A pageSize left over from the old demo dataset elsewhere in Reports (see
// DailyNationalBulletin.tsx's own comment) - the real indus_locations table
// has 57,000+ rows nationwide, and the backend applies no upper cap on this
// endpoint, so this is effectively "give me every site".
const SITE_PAGE_SIZE = 100000;

// Only Alert/Warning-band forecasts surface as an alert - a "watch"-level
// reading is left out so this feed reads as an actual attention list
// rather than reproducing most of the outlook table as "alerts".
const SEVERITY_BY_RISK: Partial<Record<RiskLevel, AlertSeverity>> = {
  warning: 'critical',
  alert: 'high',
};

const PARAM_LABEL: Record<'rainfall' | 'temperature' | 'windSpeed', string> = {
  rainfall: 'Rainfall',
  temperature: 'Temperature',
  windSpeed: 'Wind speed',
};

interface ParamConfig {
  key: 'rainfall' | 'temperature' | 'windSpeed';
  unit: string;
  getValue: (d: SkymetForecastDay) => number | null;
}

// The three parameters Skymet's own schema actually reports - see
// useSkymetSevenDayForecast's doc comment for why nothing else (Humidity,
// Visibility, Lightning, ...) is sourced from Skymet anywhere in this app.
const PARAMETERS: ParamConfig[] = [
  { key: 'rainfall', unit: 'mm', getValue: (d) => d.rainfallMm },
  { key: 'temperature', unit: '°C', getValue: (d) => d.tempMaxC },
  { key: 'windSpeed', unit: 'km/h', getValue: (d) => d.windSpeedKmh },
];

/**
 * A client-built forecast-alert feed sourced from the real Skymet 7-day
 * district outlook - added 2026-09-22 to give `ForecastAlertCard`/
 * `ForecastAlertItem` (defined in features/alerts/types.ts but, per that
 * type's own doc comment, "not wired into any page/data source yet") a real
 * feed, as the Alerts-page half of the same migration that moved the
 * Reports bulletins and Tower Risk table off their old hourly-derived 7-day
 * figures onto this per-day vendor feed - see the request that started all
 * of this: "IN alerts section , reports sections(tower risk,daily national
 * bulletin and circle bulletin) all works on 7 days forecast table not
 * hourly wise okay. please change this."
 *
 * One alert per (district, day, parameter) that reaches at least the
 * "alert" (High) band on this app's shared severity scale (severity.ts).
 * Only Rainfall, Temperature and Wind Speed are covered, since those are
 * the only parameters Skymet's own schema reports - there is no Humidity/
 * Lightning/etc. forecast alert here, rather than one built on a fabricated
 * figure.
 *
 * Skymet is a per-DISTRICT feed (every tower in a district shares one
 * outlook - see useSkymetSevenDayForecast's own doc comment), so this
 * raises one alert per district, not per tower: naming one specific real
 * tower would falsely imply a tower-level reading Skymet doesn't have.
 * `siteId`/`siteName` are filled with a synthetic per-district placeholder
 * rather than any one real tower's identity, and `state` carries the real
 * government state (not the site's own `state` field, which in this app is
 * actually a telecom circle - see districtRisk.ts's own comment).
 */
export function useSkymetForecastAlerts() {
  const { data: sitesPage, isLoading: sitesLoading } = useListSitesQuery({ pageSize: SITE_PAGE_SIZE });
  const sites = useMemo(() => sitesPage?.items ?? [], [sitesPage]);
  const { days, isLoading: skymetLoading } = useSkymetSevenDayForecast(sites);

  const alerts: ForecastAlertItem[] = useMemo(() => {
    // One representative site per (district, state) pair, chosen
    // deterministically (alphabetically first by name), so every real
    // district contributes at most one alert per parameter/day regardless
    // of how many towers it has.
    const repByKey = new Map<string, Site>();
    sites.forEach((site) => {
      const key = `${site.district}|${site.state}`;
      const existing = repByKey.get(key);
      if (!existing || site.name.localeCompare(existing.name) < 0) repByKey.set(key, site);
    });

    const result: ForecastAlertItem[] = [];
    days.forEach((day) => {
      repByKey.forEach((site) => {
        const forecastDay = day.bySiteId[site.id];
        if (!forecastDay) return;

        PARAMETERS.forEach((param) => {
          const value = param.getValue(forecastDay);
          if (value === null) return;
          const risk = getParameterRisk(param.key as WeatherParameter, value);
          const severity = SEVERITY_BY_RISK[risk];
          if (!severity) return; // 'watch'/'none' - not alert-worthy

          const threshold = getParameterThreshold(param.key as WeatherParameter, risk) ?? value;
          result.push({
            id: `skymet-${site.district}-${site.state}-${param.key}-${day.offset}`,
            siteId: `skymet-district-${site.district}-${site.state}`,
            siteName: `${site.district} district (7-day forecast)`,
            state: site.state,
            severity,
            parameter: param.key,
            message: `${PARAM_LABEL[param.key]} forecast to reach ${REPORT_RISK_LABEL[risk]} levels in ${site.district}`,
            thresholdValue: threshold,
            predictedValue: value,
            unit: param.unit,
            date: day.date ?? dayjs(day.at).format('YYYY-MM-DD'),
            daysAhead: day.offset,
          });
        });
      });
    });

    return result.sort((a, b) => a.daysAhead - b.daysAhead || b.predictedValue - a.predictedValue);
  }, [sites, days]);

  return {
    alerts,
    isLoading: sitesLoading || skymetLoading,
  };
}
