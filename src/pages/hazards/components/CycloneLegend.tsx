import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import { CLASSIFICATION_ORDER, CLASSIFICATION_COLOR } from './cycloneVisuals';

/**
 * The Cyclone layer's own on-map legend (storm category colors + the
 * observed-vs-forecast circle styling) - sits in the exact top-right slot
 * every other hazard layer's `RiskLegend` occupies (see HazardMap.tsx), so
 * switching the toolbar between layers doesn't jump the legend around.
 */
export function CycloneLegend() {
  return (
    <Paper
      elevation={4}
      sx={{
        position: 'absolute',
        top: 68,
        right: 12,
        zIndex: 900,
        px: 1.5,
        py: 1.25,
        minWidth: 190,
        backgroundColor: 'background.paper',
        opacity: 0.96,
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
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: CLASSIFICATION_COLOR[label],
                flexShrink: 0,
              }}
            />
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
            sx={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid', borderColor: 'text.primary', flexShrink: 0 }}
          />
          <Typography variant="caption">Observed</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box
            sx={{ width: 14, height: 14, borderRadius: '50%', border: '2px dashed', borderColor: 'text.secondary', flexShrink: 0 }}
          />
          <Typography variant="caption">Forecast</Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}
