import dayjs from 'dayjs';
import { sites } from './sites';
import { hashStringToSeed, seededRandom, randomInRange, pick } from '../rng';
import type { ReportFormat, ReportItem, ReportStatus } from '@/features/reports/types';

const FORMATS: ReportFormat[] = ['pdf', 'csv', 'xlsx'];
const STATUSES: ReportStatus[] = ['ready', 'ready', 'ready', 'processing', 'failed'];
const AUTHORS = ['Sumit Sharma', 'Priya Nair', 'Arjun Mehta', 'Kavita Iyer'];
const TITLES = [
  'Monthly Rainfall Summary',
  'Wind Speed Trend Report',
  'Lightning Incident Report',
  'Site-wise Weather Compliance',
  'Quarterly Climate Overview',
  'Extreme Weather Event Log',
  'Weekly Observation Digest',
];

function buildReports(): ReportItem[] {
  const rand = seededRandom(hashStringToSeed('weatherops-reports-seed'));
  const reports: ReportItem[] = [];

  for (let i = 0; i < 24; i += 1) {
    const siteCount = Math.ceil(randomInRange(rand, 1, 5));
    const chosenSites = [...sites].sort(() => rand() - 0.5).slice(0, siteCount);
    const daysAgo = Math.floor(randomInRange(rand, 0, 60));
    const generatedAt = dayjs().subtract(daysAgo, 'day').toISOString();
    const dateTo = dayjs(generatedAt).subtract(1, 'day');
    const dateFrom = dateTo.subtract(Math.ceil(randomInRange(rand, 3, 30)), 'day');

    reports.push({
      id: `report-${i + 1}`,
      title: `${pick(rand, TITLES)} #${i + 1}`,
      siteIds: chosenSites.map((s) => s.id),
      siteNames: chosenSites.map((s) => s.name),
      parameters: ['temperature', 'rainfall', 'windSpeed'],
      dateFrom: dateFrom.format('YYYY-MM-DD'),
      dateTo: dateTo.format('YYYY-MM-DD'),
      format: pick(rand, FORMATS),
      status: pick(rand, STATUSES),
      generatedBy: pick(rand, AUTHORS),
      generatedAt,
      fileSizeKb: Math.round(randomInRange(rand, 80, 4200)),
    });
  }

  return reports.sort((a, b) => dayjs(b.generatedAt).valueOf() - dayjs(a.generatedAt).valueOf());
}

export const reports: ReportItem[] = buildReports();
