import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useSnackbar } from 'notistack';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Pagination from '@mui/material/Pagination';
import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import WbCloudyRoundedIcon from '@mui/icons-material/WbCloudyRounded';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/FilterBar';
import { DateRangeSelector } from '@/components/common/DateRangeSelector';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { AlertCard } from './AlertCard';
import { AlertDetailDialog } from './AlertDetailDialog';
import { DeviationAlertCard } from './DeviationAlertCard';
import { ForecastAlertCard } from './ForecastAlertCard';
import { useSkymetForecastAlerts } from './useSkymetForecastAlerts';
import { useListAlertsQuery, useMarkAlertReadMutation, useUpdateAlertStatusMutation } from '@/features/alerts/alertsApi';
import {
  useListDeviationsQuery,
  useRunDeviationCheckMutation,
  useAcknowledgeDeviationMutation,
} from '@/features/deviations/deviationsApi';
import type { AlertItem } from '@/features/alerts/types';
import type { AlertSeverity, WeatherParameter } from '@/utils/constants';
import { ALERT_SEVERITIES, WEATHER_PARAMETERS } from '@/utils/constants';

type FeedTab = 'active' | 'forecast' | 'history' | 'deviations';

const PAGE_SIZE = 8;

export default function AlertsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState<FeedTab>('active');
  // Replaced the free-text search box with this dropdown on 2026-09-30 per
  // explicit request ("remove the search bar as [a] dropdown of the
  // parameters for all active,forecast,history") - filters every one of
  // those three tabs down to alerts for one weather parameter (Temperature,
  // Rainfall, Wind Speed, ...) instead of a free-text match against
  // site name/message. Filtered client-side in both `filtered` and
  // `filteredForecastAlerts` below, same as `severity` already is for the
  // Forecast tab (that tab's alerts never go through useListAlertsQuery at
  // all - see useSkymetForecastAlerts) - so this one filter works
  // identically across all three tabs without needing a new server-side
  // query param.
  const [parameter, setParameter] = useState<WeatherParameter | ''>('');
  const [severity, setSeverity] = useState('');
  const [range, setRange] = useState({ from: dayjs().subtract(21, 'day').format('YYYY-MM-DD'), to: dayjs().format('YYYY-MM-DD') });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AlertItem | null>(null);

  // The mock/API layer paginates and filters by status/severity server-side;
  // the date range and the parameter dropdown (see `parameter` above) are
  // both applied client-side in `filtered` below, since neither is (yet)
  // part of the documented /alerts query contract.
  const { data, isLoading, isError, refetch } = useListAlertsQuery({
    severity: (severity as AlertSeverity) || undefined,
    page: 1,
    pageSize: 500,
  });
  const [markAlertRead] = useMarkAlertReadMutation();
  const [updateStatus] = useUpdateAlertStatusMutation();

  // Deviation Alert Mechanism (scope doc section 2) - a separate feed from
  // threshold-breach alerts above: these are raised when a forecast run for
  // a given site/day diverges from the previous run by more than a
  // parameter's threshold, e.g. "Rainfall forecast revised from 12mm to
  // 38mm". Only fetched while its tab is active.
  // Fetched unconditionally (not just while its tab is active) so the tab's
  // unacknowledged-count badge is accurate as soon as the page loads.
  const { data: deviationsPage, isLoading: deviationsLoading, isError: deviationsError, refetch: refetchDeviations } =
    useListDeviationsQuery({ pageSize: 200 });
  const [runDeviationCheck, { isLoading: isRunningCheck }] = useRunDeviationCheckMutation();
  const [acknowledgeDeviationMutation] = useAcknowledgeDeviationMutation();
  const deviations = deviationsPage?.items ?? [];
  const unacknowledgedDeviations = deviations.filter((d) => !d.acknowledged).length;

  // Forecast-driven alerts (scope doc's own concept, distinct from the
  // threshold-BREACH alerts above) - built client-side from the real 7-day
  // district forecast. Originally its own tab, then folded into Active for
  // one session (per feedback that it belonged alongside the alerts a user
  // is already scanning), and now split back out into its own "Forecast"
  // tab per an explicit follow-up request for a fixed tab sequence: Active,
  // Forecast, History, Deviations. Fetched unconditionally (cheap,
  // RTK-Query-cached, same as the deviations feed above) so the data - and
  // this tab's badge - is ready the instant the page loads, not just once
  // Forecast is opened.
  const { alerts: forecastAlerts, isLoading: forecastLoading } = useSkymetForecastAlerts();

  const handleRunDeviationCheck = async () => {
    const result = await runDeviationCheck().unwrap();
    enqueueSnackbar(
      result.length > 0 ? `${result.length} new deviation${result.length === 1 ? '' : 's'} detected` : 'No new deviations detected',
      { variant: result.length > 0 ? 'warning' : 'success' }
    );
  };

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    const from = dayjs(range.from).startOf('day');
    const to = dayjs(range.to).endOf('day');
    const now = dayjs();
    return items
      .filter((a) => {
        // "Active" means still in force: not resolved AND not past its own
        // expiry (AlertCard already surfaces expiry as "(lapsed)" - this is
        // what was missing here, so a lapsed-but-never-resolved alert kept
        // showing under Active indefinitely instead of falling to History).
        const lapsed = dayjs(a.expiresAt).isBefore(now);
        return tab === 'active' ? a.status !== 'resolved' && !lapsed : a.status === 'resolved' || lapsed;
      })
      .filter((a) => {
        // Date-range filtering only applies to History - removed for Active
        // per explicit request ("in active please remove the date
        // selection"): an alert that's still in force belongs on Active
        // regardless of how long ago it triggered, so narrowing it to
        // whatever the (now-hidden) range picker happened to be set to would
        // silently hide genuinely active alerts instead of just not
        // filtering them. History (a log of what already happened) keeps the
        // range picker, since browsing/narrowing past alerts by date is the
        // whole point of that tab.
        if (tab === 'active') return true;
        const t = dayjs(a.triggeredAt);
        return (t.isAfter(from) || t.isSame(from)) && (t.isBefore(to) || t.isSame(to));
      })
      .filter((a) => !parameter || a.parameter === parameter);
  }, [data, tab, range, parameter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Forecast-driven alerts, filtered by the same parameter/severity controls
  // shown on the Forecast tab. The date-range picker is deliberately NOT
  // applied here: these are forward-looking (they describe a day in the
  // next week, not something already triggered), so filtering them by the
  // historical "triggered between" range wouldn't mean anything sensible.
  const filteredForecastAlerts = useMemo(() => {
    if (tab !== 'forecast') return [];
    return forecastAlerts.filter((a) => {
      if (severity && a.severity !== severity) return false;
      if (parameter && a.parameter !== parameter) return false;
      return true;
    });
  }, [forecastAlerts, tab, severity, parameter]);

  const handleCardClick = (alert: AlertItem) => {
    setSelected(alert);
    if (!alert.read) markAlertRead(alert.id);
  };

  const handleAcknowledge = async (id: string) => {
    await updateStatus({ id, status: 'acknowledged' }).unwrap();
    enqueueSnackbar('Alert acknowledged', { variant: 'success' });
    setSelected((prev) => (prev ? { ...prev, status: 'acknowledged', read: true } : prev));
  };

  const handleResolve = async (id: string) => {
    await updateStatus({ id, status: 'resolved' }).unwrap();
    enqueueSnackbar('Alert marked resolved', { variant: 'success' });
    setSelected(null);
  };

  return (
    <Stack spacing={2}>
      <PageHeader title="Alerts" description="Threshold breaches and weather warnings across all sites" />

      <Tabs
        value={tab}
        onChange={(_e, v: FeedTab) => {
          setTab(v);
          setPage(1);
        }}
      >
        {/* Fixed order per explicit request: Active, Forecast, History,
            Deviations. Forecast was briefly folded into Active in an
            earlier round, then split back out into its own tab here - see
            the useSkymetForecastAlerts() call above for that history. */}
        <Tab value="active" label="Active" />
        <Tab
          value="forecast"
          label={
            <Badge badgeContent={forecastAlerts.length} color="info" sx={{ '& .MuiBadge-badge': { right: -12 } }}>
              Forecast
            </Badge>
          }
        />
        <Tab value="history" label="History" />
        <Tab
          value="deviations"
          label={
            <Badge badgeContent={unacknowledgedDeviations} color="warning" sx={{ '& .MuiBadge-badge': { right: -12 } }}>
              Deviations
            </Badge>
          }
        />
      </Tabs>

      {tab === 'deviations' ? (
        <>
          <FilterBar>
            <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
              Forecast-run deviations detected across successive runs for the same site/day (scope doc section 2).
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshRoundedIcon />}
              disabled={isRunningCheck}
              onClick={handleRunDeviationCheck}
            >
              {isRunningCheck ? 'Checking…' : 'Run deviation check'}
            </Button>
          </FilterBar>

          {deviationsLoading ? (
            <LoadingState label="Loading deviation alerts..." />
          ) : deviationsError ? (
            <ErrorState onRetry={refetchDeviations} />
          ) : deviations.length === 0 ? (
            <EmptyState
              icon={<TrendingUpRoundedIcon sx={{ fontSize: 40, opacity: 0.5 }} />}
              title="No deviations detected"
              message="Run a deviation check to compare the latest forecast runs against their predecessors."
            />
          ) : (
            <Stack spacing={1.5}>
              {deviations.map((deviation) => (
                <DeviationAlertCard
                  key={deviation.id}
                  deviation={deviation}
                  onAcknowledge={() => acknowledgeDeviationMutation(deviation.id)}
                />
              ))}
            </Stack>
          )}
        </>
      ) : tab === 'forecast' ? (
        <>
          {/* Its own tab again (see the hook comment above) - same
              parameter/severity filters as Active/History, no date range
              (these are forward-looking, not something already triggered)
              and no pagination (a 7-day-ahead feed is short enough to show
              in full). */}
          <FilterBar>
            <TextField
              select
              size="small"
              label="Parameter"
              value={parameter}
              onChange={(e) => setParameter(e.target.value as WeatherParameter | '')}
              sx={{ minWidth: 170 }}
            >
              <MenuItem value="">All parameters</MenuItem>
              {WEATHER_PARAMETERS.map((p) => (
                <MenuItem key={p.value} value={p.value}>
                  {p.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">All severities</MenuItem>
              {ALERT_SEVERITIES.map((s) => (
                <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
            {(parameter || severity) && (
              <Button
                size="small"
                onClick={() => {
                  setParameter('');
                  setSeverity('');
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterBar>

          {forecastLoading ? (
            <LoadingState label="Loading forecast risk..." />
          ) : filteredForecastAlerts.length === 0 ? (
            <EmptyState
              icon={<WbCloudyRoundedIcon sx={{ fontSize: 40, opacity: 0.5 }} />}
              title="No forecast risk right now"
              message="No district is currently forecast to reach High/Extreme for the next 7 days."
            />
          ) : (
            <Stack spacing={1.5}>
              {filteredForecastAlerts.map((alert) => (
                <ForecastAlertCard key={alert.id} alert={alert} />
              ))}
            </Stack>
          )}
        </>
      ) : (
        <>
          <FilterBar>
            <TextField
              select
              size="small"
              label="Parameter"
              value={parameter}
              onChange={(e) => {
                setParameter(e.target.value as WeatherParameter | '');
                setPage(1);
              }}
              sx={{ minWidth: 170 }}
            >
              <MenuItem value="">All parameters</MenuItem>
              {WEATHER_PARAMETERS.map((p) => (
                <MenuItem key={p.value} value={p.value}>
                  {p.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Severity"
              value={severity}
              onChange={(e) => {
                setSeverity(e.target.value);
                setPage(1);
              }}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">All severities</MenuItem>
              {ALERT_SEVERITIES.map((s) => (
                <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
            {/* Shown for History only - see the `filtered` memo above for why
                Active no longer applies (or shows) a date range at all. */}
            {tab === 'history' && (
              <DateRangeSelector from={range.from} to={range.to} onChange={(r) => { setRange(r); setPage(1); }} />
            )}
            {(parameter || severity) && (
              <Button
                size="small"
                onClick={() => {
                  setParameter('');
                  setSeverity('');
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterBar>

          {isLoading ? (
            <LoadingState label="Loading alerts..." />
          ) : isError ? (
            <ErrorState onRetry={refetch} />
          ) : pageItems.length === 0 ? (
            <EmptyState
              icon={<NotificationsActiveRoundedIcon sx={{ fontSize: 40, opacity: 0.5 }} />}
              title={tab === 'active' ? 'No active alerts' : 'No resolved alerts in range'}
              message={tab === 'active' ? 'Try clearing filters.' : 'Try widening the date range or clearing filters.'}
            />
          ) : (
            <Stack spacing={1.5}>
              {pageItems.map((alert) => (
                <AlertCard key={alert.id} alert={alert} onClick={() => handleCardClick(alert)} />
              ))}
            </Stack>
          )}

          {pageCount > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
              <Pagination count={pageCount} page={page} onChange={(_e, p) => setPage(p)} color="primary" />
            </Box>
          )}
        </>
      )}

      <AlertDetailDialog alert={selected} onClose={() => setSelected(null)} onAcknowledge={handleAcknowledge} onResolve={handleResolve} />
    </Stack>
  );
}
