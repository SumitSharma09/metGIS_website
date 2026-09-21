import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useSnackbar } from 'notistack';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Pagination from '@mui/material/Pagination';
import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/FilterBar';
import { DateRangeSelector } from '@/components/common/DateRangeSelector';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { AlertCard } from './AlertCard';
import { AlertDetailDialog } from './AlertDetailDialog';
import { DeviationAlertCard } from './DeviationAlertCard';
import { useListAlertsQuery, useMarkAlertReadMutation, useUpdateAlertStatusMutation } from '@/features/alerts/alertsApi';
import {
  useListDeviationsQuery,
  useRunDeviationCheckMutation,
  useAcknowledgeDeviationMutation,
} from '@/features/deviations/deviationsApi';
import type { AlertItem } from '@/features/alerts/types';
import type { AlertSeverity } from '@/utils/constants';
import { ALERT_SEVERITIES } from '@/utils/constants';

type FeedTab = 'active' | 'history' | 'deviations';

const PAGE_SIZE = 8;

export default function AlertsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState<FeedTab>('active');
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('');
  const [range, setRange] = useState({ from: dayjs().subtract(21, 'day').format('YYYY-MM-DD'), to: dayjs().format('YYYY-MM-DD') });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AlertItem | null>(null);

  // The mock/API layer paginates and filters by status/severity/search server-side;
  // the date range is applied client-side since it's not (yet) part of the
  // documented /alerts query contract.
  const { data, isLoading, isError, refetch } = useListAlertsQuery({
    search: search || undefined,
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
        const t = dayjs(a.triggeredAt);
        return (t.isAfter(from) || t.isSame(from)) && (t.isBefore(to) || t.isSame(to));
      });
  }, [data, tab, range]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
        <Tab value="active" label="Active" />
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
      ) : (
        <>
          <FilterBar>
            <TextField
              size="small"
              placeholder="Search alerts..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              sx={{ minWidth: 240 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
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
            <DateRangeSelector from={range.from} to={range.to} onChange={(r) => { setRange(r); setPage(1); }} />
            {(search || severity) && (
              <Button
                size="small"
                onClick={() => {
                  setSearch('');
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
              message="Try widening the date range or clearing filters."
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
