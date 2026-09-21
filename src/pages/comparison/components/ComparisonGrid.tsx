import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import { EmptyState } from '@/components/common/EmptyState';
import { formatDate } from '@/utils/formatters';
import type { ComparisonRow } from '../comparisonData';

function accuracyColor(pct: number): 'success' | 'warning' | 'error' {
  if (pct >= 85) return 'success';
  if (pct >= 65) return 'warning';
  return 'error';
}

export function ComparisonGrid({ rows }: { rows: ComparisonRow[] }) {
  if (rows.length === 0) {
    return <EmptyState message="No comparison data for the selected sites." />;
  }

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 480 }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Site</TableCell>
            <TableCell align="right">Forecast Temp</TableCell>
            <TableCell align="right">Actual Temp</TableCell>
            <TableCell align="right">Forecast Rain</TableCell>
            <TableCell align="right">Actual Rain</TableCell>
            <TableCell align="right">Accuracy</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={`${r.date}-${r.siteId}`} hover>
              <TableCell>{formatDate(r.date)}</TableCell>
              <TableCell>{r.siteName}</TableCell>
              <TableCell align="right">{r.forecastTemp}°C</TableCell>
              <TableCell align="right">{r.actualTemp}°C</TableCell>
              <TableCell align="right">{r.forecastRainfall} mm</TableCell>
              <TableCell align="right">{r.actualRainfall} mm</TableCell>
              <TableCell align="right">
                <Chip size="small" label={`${r.accuracyPct}%`} color={accuracyColor(r.accuracyPct)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
