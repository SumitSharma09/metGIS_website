import { useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { RISK_LEVELS, type RiskLevel } from '@/utils/severity';
import type { RiskIntensityRow } from '../hazardData';

// PDF's own column wording for this specific table ("Low" rather than the
// Reports page's "Normal") - kept local rather than added to the shared
// REPORT_RISK_LABEL so it doesn't change that table's wording elsewhere.
const INTENSITY_COLUMN_LABEL: Record<RiskLevel, string> = {
  warning: 'Extreme',
  alert: 'High',
  watch: 'Moderate',
  none: 'Low',
};

function IntensityTable({ rows }: { rows: RiskIntensityRow[] }) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Parameter</TableCell>
            {RISK_LEVELS.map((level) => (
              <TableCell key={level} sx={{ fontWeight: 700 }}>
                {INTENSITY_COLUMN_LABEL[level]}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{row.label}</TableCell>
              {RISK_LEVELS.map((level) => (
                <TableCell key={level} sx={{ maxWidth: 260, fontSize: 12 }}>
                  {row.bands[level].length > 0 ? row.bands[level].join(', ') : 'Nil'}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

interface RiskIntensityDashboardProps {
  parameterRows: RiskIntensityRow[];
  hazardRows: RiskIntensityRow[];
}

/** "Today's Risk Intensity of Districts" collapsible dashboard - one
 *  section for weather parameters, one for hazards - matching the scope
 *  document's sample screenshots. */
export function RiskIntensityDashboard({ parameterRows, hazardRows }: RiskIntensityDashboardProps) {
  const [expanded, setExpanded] = useState<string | false>('parameters');

  return (
    <div>
      <Accordion expanded={expanded === 'parameters'} onChange={() => setExpanded(expanded === 'parameters' ? false : 'parameters')}>
        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
          <Typography fontWeight={700}>Today&apos;s Risk Intensity of Districts for Weather Parameters</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <IntensityTable rows={parameterRows} />
        </AccordionDetails>
      </Accordion>
      <Accordion expanded={expanded === 'hazard'} onChange={() => setExpanded(expanded === 'hazard' ? false : 'hazard')}>
        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
          <Typography fontWeight={700}>Today&apos;s Risk Intensity of Districts for Hazard</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <IntensityTable rows={hazardRows} />
        </AccordionDetails>
      </Accordion>
    </div>
  );
}
