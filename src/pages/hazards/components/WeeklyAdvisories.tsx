import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import { RISK_COLOR, REPORT_RISK_LABEL } from '@/utils/severity';
import type { WeeklyAdvisoryRow } from '../hazardData';

interface WeeklyAdvisoriesProps {
  rows: WeeklyAdvisoryRow[];
}

/** "Weekly advisories (monsoon preparation)" style bulletin - one row per
 *  circle, worst rainfall/wind outlook across the next 7 days plus a
 *  generated plain-language summary, matching the scope document's sample. */
export function WeeklyAdvisories({ rows }: WeeklyAdvisoriesProps) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow sx={{ '& th': { backgroundColor: 'primary.main', color: 'primary.contrastText', fontWeight: 700 } }}>
            <TableCell>Region</TableCell>
            <TableCell>Circle</TableCell>
            <TableCell>Forecast - Rainfall</TableCell>
            <TableCell>Forecast - Wind/Thunderstorm</TableCell>
            {rows[0]?.days.map((d) => (
              <TableCell key={d.label} align="center">
                {d.label}
              </TableCell>
            ))}
            <TableCell>Weather Summary</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.circle}>
              <TableCell>{row.region}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{row.circle}</TableCell>
              <TableCell>{row.rainfallOutlook}</TableCell>
              <TableCell>{row.windOutlook}</TableCell>
              {row.days.map((d, i) => (
                <TableCell key={i} align="center" sx={{ p: 0.5 }}>
                  <Box
                    sx={{
                      py: 0.5,
                      borderRadius: 1,
                      backgroundColor: RISK_COLOR[d.risk],
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 11,
                    }}
                  >
                    {REPORT_RISK_LABEL[d.risk]}
                  </Box>
                </TableCell>
              ))}
              <TableCell sx={{ minWidth: 260, fontSize: 12.5 }}>{row.summary}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
