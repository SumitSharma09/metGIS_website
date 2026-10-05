import type { AlertSeverity, WeatherParameter } from '@/utils/constants';

export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

export interface AlertItem {
  id: string;
  siteId: string;
  siteName: string;
  severity: AlertSeverity;
  parameter: WeatherParameter;
  message: string;
  thresholdValue: number;
  observedValue: number;
  unit: string;
  triggeredAt: string; // ISO datetime
  expiresAt: string; // ISO datetime - shown as "EXPIRES" on the Alerts feed card
  status: AlertStatus;
  read: boolean;
}

/** A forecast-driven alert (e.g. "Heavy rainfall predicted in 2 days") -
 *  distinct from AlertItem above, which is a threshold-BREACH alert from an
 *  already-observed reading. Used by ForecastAlertCard.tsx; that component
 *  isn't wired into any page/data source yet (no mock or API endpoint
 *  currently produces this shape) - this type was missing entirely, which
 *  is why the build failed. Defined here to match exactly what
 *  ForecastAlertCard.tsx already reads off `alert`, so the component at
 *  least compiles; still needs a real data source before it can be used. */
export interface ForecastAlertItem {
  id: string;
  siteId: string;
  siteName: string;
  state: string;
  severity: AlertSeverity;
  parameter: WeatherParameter;
  message: string;
  thresholdValue: number;
  predictedValue: number;
  unit: string;
  date: string; // ISO date the forecast is for
  daysAhead: number;
}

export interface AlertListQuery {
  search?: string;
  severity?: AlertSeverity;
  status?: AlertStatus;
  siteId?: string;
  page?: number;
  pageSize?: number;
}
