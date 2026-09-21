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

export interface AlertListQuery {
  search?: string;
  severity?: AlertSeverity;
  status?: AlertStatus;
  siteId?: string;
  page?: number;
  pageSize?: number;
}
