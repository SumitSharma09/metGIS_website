import dayjs from 'dayjs';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import AirRoundedIcon from '@mui/icons-material/AirRounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import { RISK_COLOR } from '@/utils/severity';
import { CYCLONE_WARNING_LABEL, type CycloneSystem } from '../hazardData';
import { CLASSIFICATION_COLOR, compassBearing } from './cycloneVisuals';

interface CycloneSummaryProps {
  cyclone: CycloneSystem;
}

/**
 * The non-map half of what used to be a standalone CycloneMap: the header
 * stat card and district warnings table. Rendered underneath HazardMap
 * whenever its toggle has Cyclone selected (see HazardMap.tsx), since these
 * only make sense while that track is actually the thing on screen.
 */
export function CycloneSummary({ cyclone }: CycloneSummaryProps) {
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

  return (
    <Stack spacing={2}>
      <Paper
        elevation={3}
        sx={{ p: 2, borderLeft: '6px solid', borderLeftColor: CLASSIFICATION_COLOR[current.classification] }}
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
