import Chip from '@mui/material/Chip';
import { severityColors } from '@/theme/theme';
import type { AlertSeverity, SiteStatus } from '@/utils/constants';
import type { AlertStatus } from '@/features/alerts/types';

const SITE_STATUS_COLOR: Record<SiteStatus, 'success' | 'default' | 'warning'> = {
  active: 'success',
  inactive: 'default',
  maintenance: 'warning',
};

const ALERT_STATUS_COLOR: Record<AlertStatus, 'error' | 'warning' | 'success'> = {
  active: 'error',
  acknowledged: 'warning',
  resolved: 'success',
};

export function SiteStatusChip({ status }: { status: SiteStatus }) {
  return <Chip size="small" label={status} color={SITE_STATUS_COLOR[status]} variant="outlined" sx={{ textTransform: 'capitalize' }} />;
}

export function AlertStatusChip({ status }: { status: AlertStatus }) {
  return <Chip size="small" label={status} color={ALERT_STATUS_COLOR[status]} sx={{ textTransform: 'capitalize' }} />;
}

export function SeverityChip({ severity }: { severity: AlertSeverity }) {
  return (
    <Chip
      size="small"
      label={severity}
      sx={{
        textTransform: 'capitalize',
        color: '#fff',
        backgroundColor: severityColors[severity],
      }}
    />
  );
}
