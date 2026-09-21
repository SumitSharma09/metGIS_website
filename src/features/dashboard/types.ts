import type { AlertItem } from '@/features/alerts/types';
import type { AlertSeverity } from '@/utils/constants';

export interface DashboardStats {
  totalSites: number;
  activeSites: number;
  sitesInMaintenance: number;
  inactiveSites: number;
  activeAlertsBySeverity: Record<AlertSeverity, number>;
  avgTemperature: number;
  totalRainfallTodayMm: number;
  sitesWithLightningRisk: number;
  recentAlerts: AlertItem[];
  topRainfallSites: { siteId: string; siteName: string; rainfallMm: number }[];
  circleSummary: { circle: string; siteCount: number; avgTemperature: number }[];
}
