import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { USE_MOCK_API } from '@/utils/constants';
import { useClock } from '@/utils/useClock';

/** Slim operational status strip pinned to the bottom of the app shell,
 *  mirroring the reference tool's footer readout (data source + sync time). */
export function StatusFooter() {
  const now = useClock(1000 * 15);

  return (
    <Box
      component="footer"
      sx={{
        borderTop: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        px: 2,
        py: 0.75,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        divider={<Divider orientation="vertical" flexItem />}
        sx={{ flexWrap: 'wrap' }}
      >
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'success.main' }} />
          <Typography variant="caption" color="text.secondary">
            All systems operational
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          Data source: {USE_MOCK_API ? 'Simulated feed' : 'Live API'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Last synced {now.format('HH:mm:ss')}
        </Typography>
      </Stack>
    </Box>
  );
}
