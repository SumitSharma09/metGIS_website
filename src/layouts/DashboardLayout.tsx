import Box from '@mui/material/Box';
import { Outlet, useLocation } from 'react-router-dom';
import { OpsTopNav } from '@/components/layout/OpsTopNav';
import { StatusFooter } from '@/components/layout/StatusFooter';
import { ROUTES } from '@/routes/routePaths';

/**
 * Primary app shell: a horizontal top nav (Live Map / Alerts / Reports /
 * Comparison) rather than a side drawer, matching the reference ops tool.
 * Most pages scroll normally inside the padded content area; the Live Map
 * is the one page that needs an edge-to-edge, fixed-height canvas for the
 * Leaflet map, so it opts out of the padding/scroll behavior here.
 */
export function DashboardLayout() {
  const location = useLocation();
  const isFullBleed = location.pathname.startsWith(ROUTES.liveMap);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <OpsTopNav />
      <Box
        component="main"
        sx={{
          flex: 1,
          minHeight: 0,
          backgroundColor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
          ...(isFullBleed
            ? { overflow: 'hidden' }
            : { overflow: 'auto', p: { xs: 2, md: 3 } }),
        }}
      >
        <Outlet />
      </Box>
      <StatusFooter />
    </Box>
  );
}
