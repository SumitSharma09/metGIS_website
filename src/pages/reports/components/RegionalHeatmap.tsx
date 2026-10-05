import { useMemo } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import { EmptyState } from '@/components/common/EmptyState';
import { RISK_COLOR, REPORT_RISK_LABEL, worseRisk, type RiskLevel } from '@/utils/severity';
import { computeOverallRisk } from '../riskAggregation';
import type { Site } from '@/features/sites/types';
import type { ForecastDaySnapshot } from '../useFiveDayObservations';

interface RegionalHeatmapProps {
  sites: Site[];
  days: ForecastDaySnapshot[];
}

export function RegionalHeatmap({ sites, days }: RegionalHeatmapProps) {
  const districts = useMemo(() => Array.from(new Set(sites.map((s) => s.district))).sort(), [sites]);
  const siteById = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);

  if (districts.length === 0) {
    return <EmptyState message="No sites match the selected region." />;
  }

  const riskFor = (district: string, day: ForecastDaySnapshot): RiskLevel => {
    let worst: RiskLevel = 'none';
    for (const obs of day.observations) {
      const site = siteById.get(obs.siteId);
      if (site && site.district === district) {
        worst = worseRisk(worst, computeOverallRisk(obs));
      }
    }
    return worst;
  };

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>District</TableCell>
            {days.map((d) => (
              <TableCell key={d.offset} align="center">
                {d.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {districts.map((district) => (
            <TableRow key={district}>
              <TableCell sx={{ fontWeight: 600 }}>{district}</TableCell>
              {days.map((day) => {
                const risk = riskFor(district, day);
                return (
                  <TableCell key={day.offset} align="center" sx={{ p: 0.5 }}>
                    <Box
                      sx={{
                        py: 0.5,
                        borderRadius: 1,
                        backgroundColor: RISK_COLOR[risk],
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 11,
                      }}
                    >
                      {REPORT_RISK_LABEL[risk]}
                    </Box>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
