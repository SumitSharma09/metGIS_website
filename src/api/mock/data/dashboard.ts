import { sites as allSites, circles as allCircles } from './sites';
import { alerts as allAlerts } from './alerts';
import { getCurrentObservation } from './weather';
import { inScopeSiteIdSet, restrictSites, isPanIndia } from '@/utils/accessScope';
import type { UserProfile } from '@/features/users/types';
import type { DashboardStats } from '@/features/dashboard/types';
import type { AlertSeverity } from '@/utils/constants';

export function buildDashboardStats(user?: UserProfile | null): DashboardStats {
  // RBAC: every figure here (site counts, alerts, top-rainfall sites, per-
  // circle averages) is derived from `sites`/`alerts`, so scoping those two
  // inputs up front scopes the whole dashboard for a non-admin.
  const sites = restrictSites(user, allSites);
  const inScopeSiteIds = inScopeSiteIdSet(user, allSites);
  const alerts = allAlerts.filter((a) => inScopeSiteIds.has(a.siteId));
  const circles = isPanIndia(user) ? allCircles : [...new Set(sites.map((s) => s.circle))].sort();

  const activeSites = sites.filter((s) => s.status === 'active').length;
  const sitesInMaintenance = sites.filter((s) => s.status === 'maintenance').length;
  const inactiveSites = sites.filter((s) => s.status === 'inactive').length;

  const activeAlertsBySeverity = alerts
    .filter((a) => a.status === 'active')
    .reduce(
      (acc, alert) => {
        acc[alert.severity] = (acc[alert.severity] ?? 0) + 1;
        return acc;
      },
      { critical: 0, high: 0, moderate: 0, low: 0, info: 0 } as Record<AlertSeverity, number>
    );

  const observations = sites.map((s) => ({ site: s, obs: getCurrentObservation(s.id) }));
  const avgTemperature =
    observations.reduce((sum, o) => sum + o.obs.temperature, 0) / (observations.length || 1);
  const totalRainfallTodayMm = observations.reduce((sum, o) => sum + o.obs.rainfallToday, 0);
  const sitesWithLightningRisk = observations.filter((o) => o.obs.lightningStrikesLastHour > 0).length;

  const topRainfallSites = [...observations]
    .sort((a, b) => b.obs.rainfallToday - a.obs.rainfallToday)
    .slice(0, 5)
    .map((o) => ({ siteId: o.site.id, siteName: o.site.name, rainfallMm: o.obs.rainfallToday }));

  const circleSummary = circles.map((circle) => {
    const circleObs = observations.filter((o) => o.site.circle === circle);
    return {
      circle,
      siteCount: circleObs.length,
      avgTemperature: Number(
        (circleObs.reduce((sum, o) => sum + o.obs.temperature, 0) / (circleObs.length || 1)).toFixed(1)
      ),
    };
  });

  return {
    totalSites: sites.length,
    activeSites,
    sitesInMaintenance,
    inactiveSites,
    activeAlertsBySeverity,
    avgTemperature: Number(avgTemperature.toFixed(1)),
    totalRainfallTodayMm: Number(totalRainfallTodayMm.toFixed(1)),
    sitesWithLightningRisk,
    recentAlerts: alerts.slice(0, 6),
    topRainfallSites,
    circleSummary,
  };
}
