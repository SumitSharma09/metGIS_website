import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import { SeverityChip, AlertStatusChip } from '@/components/common/StatusChip';
import { severityColors } from '@/theme/theme';
import { formatDateTime, formatRelative } from '@/utils/formatters';
import dayjs from 'dayjs';
import type { AlertItem } from '@/features/alerts/types';

interface AlertCardProps {
  alert: AlertItem;
  onClick: () => void;
}

export function AlertCard({ alert, onClick }: AlertCardProps) {
  const expired = dayjs(alert.expiresAt).isBefore(dayjs());

  return (
    <Card
      variant="outlined"
      sx={{
        borderLeft: '5px solid',
        borderLeftColor: severityColors[alert.severity],
        opacity: alert.read ? 0.85 : 1,
      }}
    >
      <CardActionArea onClick={onClick}>
        <CardContent>
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={12} sm="auto">
              <Stack direction="row" spacing={1}>
                <SeverityChip severity={alert.severity} />
                <AlertStatusChip status={alert.status} />
                {!alert.read && (
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'primary.main', alignSelf: 'center' }} />
                )}
              </Stack>
            </Grid>
            <Grid item xs>
              <Typography variant="subtitle2" fontWeight={700}>
                {alert.message}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {alert.siteName}
              </Typography>
            </Grid>
            <Grid item xs={12} sm="auto">
              <Stack spacing={0.25} alignItems={{ xs: 'flex-start', sm: 'flex-end' }}>
                <Typography variant="caption" color="text.secondary">
                  Issued: {formatDateTime(alert.triggeredAt)} ({formatRelative(alert.triggeredAt)})
                </Typography>
                <Typography variant="caption" color={expired ? 'text.disabled' : 'text.secondary'}>
                  Expires: {formatDateTime(alert.expiresAt)}
                  {expired ? ' (lapsed)' : ''}
                </Typography>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
