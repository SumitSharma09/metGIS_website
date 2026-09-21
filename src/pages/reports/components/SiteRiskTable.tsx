import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import type { Site } from '@/features/sites/types';
import type { CurrentObservation } from '@/features/weather/types';
import { RISK_COLOR, REPORT_RISK_LABEL, type RiskLevel } from '@/utils/severity';
import { EmptyState } from '@/components/common/EmptyState';
import { formatWithUnit } from '@/utils/formatters';

export interface SiteRiskRow {
  site: Site;
  obs: CurrentObservation;
  overallRisk: RiskLevel;
}

export function SiteRiskTable({ rows }: { rows: SiteRiskRow[] }) {
  if (rows.length === 0) {
    return <EmptyState message="No sites match the selected region." />;
  }

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 480 }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell>Site</TableCell>
            <TableCell>District</TableCell>
            <TableCell align="right">Temp.</TableCell>
            <TableCell align="right">Rainfall</TableCell>
            <TableCell align="right">Wind</TableCell>
            <TableCell align="right">Humidity</TableCell>
            <TableCell align="right">Lightning</TableCell>
            <TableCell>Overall Risk</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(({ site, obs, overallRisk }) => (
            <TableRow key={site.id} hover>
              <TableCell>
                <strong>{site.name}</strong>
                <br />
                <span style={{ opacity: 0.6, fontSize: 11 }}>{site.code}</span>
              </TableCell>
              <TableCell>
                {site.district}
                <br />
                <span style={{ opacity: 0.6, fontSize: 11 }}>{site.state}</span>
              </TableCell>
              <TableCell align="right">{formatWithUnit(obs.temperature, '°C')}</TableCell>
              <TableCell align="right">{formatWithUnit(obs.rainfallLastHour, 'mm/hr')}</TableCell>
              <TableCell align="right">{formatWithUnit(obs.windSpeed, 'km/h')}</TableCell>
              <TableCell align="right">{obs.humidity}%</TableCell>
              <TableCell align="right">{obs.lightningStrikesLastHour}</TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={REPORT_RISK_LABEL[overallRisk]}
                  sx={{ backgroundColor: RISK_COLOR[overallRisk], color: '#fff', fontWeight: 700 }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
