import { useState } from 'react';
import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import SatelliteAltRoundedIcon from '@mui/icons-material/SatelliteAltRounded';
import AirRoundedIcon from '@mui/icons-material/AirRounded';
import { MapContainer, TileLayer, Circle, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { RISK_COLOR } from '@/utils/severity';
import { IndiaBoundaryOutline } from '@/pages/live-map/components/IndiaBoundaryOutline';
import { CYCLONE_WARNING_LABEL, cycloneImpactRadiusKm, type CycloneSystem } from '../hazardData';

// Ordered least -> most severe, matching hazardData.ts's CYCLONE_BANDS.
const CLASSIFICATION_ORDER = [
  'Low Pressure Area',
  'Depression',
  'Deep Depression',
  'Cyclonic Storm',
  'Severe Cyclonic Storm',
  'Very Severe Cyclonic Storm',
  'Super Cyclonic Storm',
] as const;

const CLASSIFICATION_COLOR: Record<string, string> = {
  'Low Pressure Area': '#94a3b8',
  Depression: '#38bdf8',
  'Deep Depression': '#0ea5e9',
  'Cyclonic Storm': '#eab308',
  'Severe Cyclonic Storm': '#f97316',
  'Very Severe Cyclonic Storm': '#dc2626',
  'Super Cyclonic Storm': '#7c3aed',
};

type CycloneBasemap = 'street' | 'satellite';

const TILE_LAYERS: Record<CycloneBasemap, { url: string; attribution: string }> = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
  },
};

/** 16-point compass bearing from one track point to the next - used to give
 *  the storm's recent motion in plain words (e.g. "north-northwest") instead
 *  of just plotting the line and leaving the reader to work it out. */
function compassBearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): string {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLon = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const points = [
    'north', 'north-northeast', 'northeast', 'east-northeast',
    'east', 'east-southeast', 'southeast', 'south-southeast',
    'south', 'south-southwest', 'southwest', 'west-southwest',
    'west', 'west-northwest', 'northwest', 'north-northwest',
  ];
  return points[Math.round(bearing / 22.5) % 16];
}

interface CycloneMapProps {
  cyclone: CycloneSystem;
}

export function CycloneMap({ cyclone }: CycloneMapProps) {
  const [basemap, setBasemap] = useState<CycloneBasemap>('satellite');

  const observed = cyclone.track.filter((p) => p.observed);
  const forecast = cyclone.track.filter((p) => !p.observed);
  const current = observed[observed.length - 1] ?? cyclone.track[0];
  const previous = observed[observed.length - 2];
  const trend =
    previous == null
      ? null
      : current.windKmph > previous.windKmph
      ? 'intensifying'
      : current.windKmph < previous.windKmph
      ? 'weakening'
      : 'steady';
  const direction = previous ? compassBearing(previous, current) : null;

  const center: [number, number] = [
    cyclone.track[Math.floor(cyclone.track.length / 2)].lat,
    cyclone.track[Math.floor(cyclone.track.length / 2)].lng,
  ];
  const currentIndex = cyclone.track.indexOf(current);

  return (
    <Stack spacing={2}>
      <Paper
        elevation={3}
        sx={{
          p: 2,
          borderLeft: '6px solid',
          borderLeftColor: CLASSIFICATION_COLOR[current.classification],
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={1.5}
        >
          <Stack spacing={0.5}>
            <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="h6" fontWeight={700}>
                {cyclone.name}
              </Typography>
              <Chip
                size="small"
                label={current.classification}
                sx={{ backgroundColor: CLASSIFICATION_COLOR[current.classification], color: '#fff', fontWeight: 700 }}
              />
              <Chip size="small" variant="outlined" label={cyclone.advisory} sx={{ fontWeight: 600 }} />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {cyclone.basin}
              {direction && trend ? ` · Moving ${direction}, ${trend}` : ''} &middot; Updated{' '}
              {dayjs(current.at).format('DD MMM, HH:mm')}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={3}>
            <HeaderStat icon={<AirRoundedIcon fontSize="small" />} label="Sustained wind" value={`${current.windKmph} km/h`} />
            <HeaderStat
              icon={<MapRoundedIcon fontSize="small" />}
              label="Track span"
              value={`${observed.length}d observed · ${forecast.length}d forecast`}
            />
          </Stack>
        </Stack>
      </Paper>

      <Paper elevation={4} sx={{ overflow: 'hidden', borderRadius: 2, position: 'relative' }}>
        <Box sx={{ height: 560 }}>
          <MapContainer center={center} zoom={6} style={{ height: '100%', width: '100%' }}>
            <TileLayer key={basemap} url={TILE_LAYERS[basemap].url} attribution={TILE_LAYERS[basemap].attribution} />
            <IndiaBoundaryOutline />

            {/* No connecting track line - each indexed point along the
               system's path instead gets its own likely-affected-area
               circle, sized by that point's category (see
               cycloneImpactRadiusKm) and colored by its condition, the way
               an actual advisory bulletin maps the storm's reach rather
               than just its center line. Forecast points get a dashed
               outline and lighter fill to mark them as projected, not
               observed. */}
            {cyclone.track.map((p, i) => {
              const isCurrent = i === currentIndex;
              const color = CLASSIFICATION_COLOR[p.classification];
              return (
                <Circle
                  key={i}
                  center={[p.lat, p.lng]}
                  radius={cycloneImpactRadiusKm(p.classification) * 1000}
                  pathOptions={{
                    color,
                    weight: isCurrent ? 3 : 2,
                    opacity: p.observed ? 0.9 : 0.65,
                    dashArray: p.observed ? undefined : '10 8',
                    fillColor: color,
                    fillOpacity: p.observed ? 0.28 : 0.16,
                  }}
                >
                  <Tooltip>
                    <strong>{p.classification}</strong>
                    <br />
                    {p.windKmph} km/h &bull; {dayjs(p.at).format('DD MMM, HH:mm')}
                    <br />
                    Likely affected radius: ~{cycloneImpactRadiusKm(p.classification)} km
                    <br />
                    {p.observed ? 'Observed' : 'Forecast'}
                  </Tooltip>
                </Circle>
              );
            })}

            {/* A small, fixed-size dot marks each point's exact center
               (independent of the affected-area circle's radius), so the
               track's actual index/position is still readable even where
               two categories' circles overlap heavily. */}
            {cyclone.track.map((p, i) => {
              const isCurrent = i === currentIndex;
              return (
                <CircleMarker
                  key={i}
                  center={[p.lat, p.lng]}
                  radius={isCurrent ? 8 : 5}
                  pathOptions={{
                    color: '#ffffff',
                    weight: isCurrent ? 3 : 1.5,
                    fillColor: CLASSIFICATION_COLOR[p.classification],
                    fillOpacity: 1,
                  }}
                >
                  {isCurrent && (
                    <Tooltip permanent direction="top" offset={[0, -10]} className="cyclone-current-label">
                      Current position
                    </Tooltip>
                  )}
                </CircleMarker>
              );
            })}
          </MapContainer>
        </Box>

        <ToggleButtonGroup
          size="small"
          exclusive
          value={basemap}
          onChange={(_e, value: CycloneBasemap | null) => value && setBasemap(value)}
          sx={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 1000,
            backgroundColor: 'background.paper',
            opacity: 0.97,
          }}
        >
          <ToggleButton value="street" sx={{ px: 1.25, gap: 0.5, textTransform: 'none' }}>
            <MapRoundedIcon fontSize="small" /> Street
          </ToggleButton>
          <ToggleButton value="satellite" sx={{ px: 1.25, gap: 0.5, textTransform: 'none' }}>
            <SatelliteAltRoundedIcon fontSize="small" /> Satellite
          </ToggleButton>
        </ToggleButtonGroup>

        <Paper
          elevation={4}
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 1000,
            px: 1.5,
            py: 1.25,
            minWidth: 190,
            backgroundColor: 'background.paper',
            opacity: 0.97,
          }}
        >
          <Typography
            variant="caption"
            fontWeight={700}
            color="text.secondary"
            sx={{ display: 'block', mb: 1, letterSpacing: 0.5 }}
          >
            STORM CATEGORY
          </Typography>
          <Stack spacing={0.6}>
            {[...CLASSIFICATION_ORDER].reverse().map((label) => (
              <Stack key={label} direction="row" alignItems="center" spacing={1}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: CLASSIFICATION_COLOR[label], flexShrink: 0 }} />
                <Typography variant="caption" sx={{ lineHeight: 1.2 }}>
                  {label}
                </Typography>
              </Stack>
            ))}
          </Stack>
          <Divider sx={{ my: 1 }} />
          <Typography
            variant="caption"
            fontWeight={700}
            color="text.secondary"
            sx={{ display: 'block', mb: 0.75, letterSpacing: 0.5 }}
          >
            AFFECTED AREA
          </Typography>
          <Stack spacing={0.6}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: '2px solid',
                  borderColor: 'text.primary',
                  flexShrink: 0,
                }}
              />
              <Typography variant="caption">Observed</Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: '2px dashed',
                  borderColor: 'text.secondary',
                  flexShrink: 0,
                }}
              />
              <Typography variant="caption">Forecast</Typography>
            </Stack>
          </Stack>
        </Paper>
      </Paper>

      <div>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
          District Warnings
        </Typography>
        <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>State</TableCell>
                <TableCell>District</TableCell>
                <TableCell>Warning Level</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cyclone.districtWarnings.map((w) => (
                <TableRow key={`${w.state}-${w.district}`}>
                  <TableCell>{w.state}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{w.district}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={CYCLONE_WARNING_LABEL[w.level]}
                      sx={{ backgroundColor: RISK_COLOR[w.level], color: '#fff', fontWeight: 700 }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>
    </Stack>
  );
}

function HeaderStat({ icon, label, value }: { icon: JSX.Element; label: string; value: string }) {
  return (
    <Stack spacing={0.25} alignItems="flex-start">
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'text.secondary' }}>
        {icon}
        <Typography variant="caption" sx={{ letterSpacing: 0.3 }}>
          {label}
        </Typography>
      </Stack>
      <Typography variant="body2" fontWeight={700}>
        {value}
      </Typography>
    </Stack>
  );
}
