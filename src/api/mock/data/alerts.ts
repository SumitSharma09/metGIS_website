import dayjs from 'dayjs';
import { sites } from './sites';
import { hashStringToSeed, seededRandom, randomInRange, pick } from '../rng';
import type { AlertItem, AlertStatus } from '@/features/alerts/types';
import type { AlertSeverity, WeatherParameter } from '@/utils/constants';

const PARAMETER_MESSAGES: Record<WeatherParameter, { message: string; unit: string; threshold: number }> = {
  windSpeed: { message: 'High wind speed detected', unit: 'km/h', threshold: 40 },
  rainfall: { message: 'Heavy rainfall detected', unit: 'mm/hr', threshold: 20 },
  lightning: { message: 'Lightning activity detected nearby', unit: 'strikes', threshold: 10 },
  temperature: { message: 'Extreme temperature detected', unit: '°C', threshold: 42 },
  humidity: { message: 'Abnormal humidity levels', unit: '%', threshold: 95 },
  pressure: { message: 'Rapid pressure drop detected', unit: 'hPa', threshold: 995 },
  windDirection: { message: 'Sudden wind direction shift', unit: '°', threshold: 0 },
};

const SEVERITIES: AlertSeverity[] = ['critical', 'high', 'moderate', 'low', 'info'];
const STATUSES: AlertStatus[] = ['active', 'acknowledged', 'resolved'];
const PARAMETERS: WeatherParameter[] = ['windSpeed', 'rainfall', 'lightning', 'temperature', 'humidity', 'pressure'];

function buildAlerts(): AlertItem[] {
  const rand = seededRandom(hashStringToSeed('weatherops-alerts-seed'));
  const alerts: AlertItem[] = [];

  for (let i = 0; i < 42; i += 1) {
    const site = pick(rand, sites);
    const parameter = pick(rand, PARAMETERS);
    const severity = pick(rand, SEVERITIES);
    const status = pick(rand, STATUSES);
    const { message, unit, threshold } = PARAMETER_MESSAGES[parameter];
    const hoursAgo = Math.floor(randomInRange(rand, 0, 24 * 21));
    const triggeredAt = dayjs().subtract(hoursAgo, 'hour').toISOString();
    const observedValue = threshold + randomInRange(rand, 1, threshold * 0.6);
    // Validity window: most alerts run 6-48h from issue; resolved alerts
    // always expire in the past, active/acknowledged ones may still be
    // in-force (expiry in the future) or lapsed.
    const validityHours = randomInRange(rand, 6, 48);
    const expiresAt = dayjs(triggeredAt).add(validityHours, 'hour').toISOString();

    alerts.push({
      id: `alert-${i + 1}`,
      siteId: site.id,
      siteName: site.name,
      severity,
      parameter,
      message: `${message} at ${site.name}`,
      thresholdValue: Number(threshold.toFixed(1)),
      observedValue: Number(observedValue.toFixed(1)),
      unit,
      triggeredAt,
      expiresAt,
      status,
      read: status !== 'active' ? true : rand() > 0.4,
    });
  }

  return alerts.sort((a, b) => dayjs(b.triggeredAt).valueOf() - dayjs(a.triggeredAt).valueOf());
}

// Generated once per session (module load) so alert state (read/status) is
// stable while the app is running, and mutable in place to support
// mark-as-read / acknowledge / resolve actions in the mock layer.
export const alerts: AlertItem[] = buildAlerts();
