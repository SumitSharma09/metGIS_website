import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { SeverityChip, AlertStatusChip } from '@/components/common/StatusChip';
import { severityColors } from '@/theme/theme';
import { formatDateTime } from '@/utils/formatters';
import { useGetSiteDetailQuery } from '@/features/sites/sitesApi';
import type { AlertItem } from '@/features/alerts/types';

interface AlertDetailDialogProps {
  alert: AlertItem | null;
  onClose: () => void;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}

export function AlertDetailDialog({ alert, onClose, onAcknowledge, onResolve }: AlertDetailDialogProps) {
  const { data: site } = useGetSiteDetailQuery(alert?.siteId ?? '', { skip: !alert });

  if (!alert) return null;

  return (
    <Dialog open={Boolean(alert)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <SeverityChip severity={alert.severity} />
          <AlertStatusChip status={alert.status} />
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <Typography variant="subtitle1" fontWeight={700}>
            {alert.message}
          </Typography>
          <Row label="Site" value={alert.siteName} />
          <Row label="Parameter" value={alert.parameter} />
          <Row label="Observed Value" value={`${alert.observedValue} ${alert.unit}`} />
          <Row label="Threshold" value={`${alert.thresholdValue} ${alert.unit}`} />
          <Row label="Issued" value={formatDateTime(alert.triggeredAt)} />
          <Row label="Expires" value={formatDateTime(alert.expiresAt)} />

          {site && (
            <Box sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider', height: 200 }}>
              <MapContainer
                center={[site.latitude, site.longitude]}
                zoom={11}
                style={{ height: '100%', width: '100%' }}
                dragging={false}
                scrollWheelZoom={false}
                doubleClickZoom={false}
                zoomControl={false}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="&copy; OpenStreetMap contributors"
                />
                <CircleMarker
                  center={[site.latitude, site.longitude]}
                  radius={11}
                  pathOptions={{ color: '#fff', weight: 2, fillColor: severityColors[alert.severity], fillOpacity: 0.9 }}
                >
                  <Popup>{site.name}</Popup>
                </CircleMarker>
              </MapContainer>
            </Box>
          )}

          <Divider />
          <Typography variant="caption" color="text.secondary">
            Once connected to the live backend, this panel will also show the acknowledgement trail and any
            field-team notes attached to this alert.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Close
        </Button>
        {alert.status === 'active' && (
          <Button onClick={() => onAcknowledge(alert.id)} variant="outlined">
            Acknowledge
          </Button>
        )}
        {alert.status !== 'resolved' && (
          <Button onClick={() => onResolve(alert.id)} variant="contained">
            Mark Resolved
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} sx={{ textTransform: 'capitalize' }}>
        {value}
      </Typography>
    </Stack>
  );
}
