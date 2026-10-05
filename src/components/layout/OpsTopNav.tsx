import { useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import StormRoundedIcon from '@mui/icons-material/StormRounded';
import CompareArrowsRoundedIcon from '@mui/icons-material/CompareArrowsRounded';
import ConstructionRoundedIcon from '@mui/icons-material/ConstructionRounded';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import { useGetUnreadAlertCountQuery } from '@/features/alerts/alertsApi';
import { NotificationMenu } from './NotificationMenu';
import { ProfileMenu } from './ProfileMenu';
import { LogoutButton } from './LogoutButton';
import { ROUTES } from '@/routes/routePaths';
import { useClock } from '@/utils/useClock';
import { COMPANY_NAME, COMPANY_TAGLINE } from '@/utils/branding';
import bkcLogo from '@/assets/branding/bkc-weathersys-logo.png';

// "Comparison" re-added 2026-09-22 - the district-level Forecast vs Actual
// rework (real indus_districts_actual_gtsData/skymet_save_forecast_data
// tables, see ComparisonPage.tsx/IndusDistrictComparisonService) is now
// wired up end to end, so it's shown to end users again.
const NAV_ITEMS = [
  { label: 'Live Map', to: ROUTES.liveMap, icon: <PublicRoundedIcon fontSize="small" /> },
  { label: 'Hazards', to: ROUTES.hazards, icon: <StormRoundedIcon fontSize="small" /> },
  { label: 'Alerts', to: ROUTES.alerts, icon: <NotificationsActiveRoundedIcon fontSize="small" /> },
  { label: 'Reports', to: ROUTES.reports, icon: <DescriptionRoundedIcon fontSize="small" /> },
  { label: 'Comparison', to: ROUTES.comparison, icon: <CompareArrowsRoundedIcon fontSize="small" /> },
];

/** Small pulsing dot + "LIVE" label indicating the app is on the live,
 *  auto-refreshing data feed (as opposed to a historical/frozen view). */
function LiveBadge() {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={0.75}
      sx={{
        px: 1,
        py: 0.4,
        borderRadius: 999,
        backgroundColor: 'rgba(220, 38, 38, 0.12)',
        border: '1px solid rgba(220, 38, 38, 0.4)',
      }}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: 'error.main',
          animation: 'ops-live-pulse 1.6s ease-in-out infinite',
          '@keyframes ops-live-pulse': {
            '0%': { opacity: 1, transform: 'scale(1)' },
            '50%': { opacity: 0.4, transform: 'scale(1.3)' },
            '100%': { opacity: 1, transform: 'scale(1)' },
          },
        }}
      />
      <Typography variant="caption" fontWeight={700} color="error.main" letterSpacing={0.5}>
        LIVE
      </Typography>
    </Stack>
  );
}

export function OpsTopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const now = useClock();
  const { data: unread } = useGetUnreadAlertCountQuery();
  // Hazards is still an active work item (mock cyclone/flood data, no real
  // NDMA/NDRF feeds - see hazardData.ts) - per explicit 2026-09-24 request,
  // the nav tab no longer navigates there; it shows a "work in progress"
  // notice instead so end users aren't shown an unfinished section.
  const [hazardsNoticeOpen, setHazardsNoticeOpen] = useState(false);

  const activeTab = NAV_ITEMS.find((item) => matchPath({ path: `${item.to}/*` }, location.pathname))?.to ?? false;

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{ backgroundColor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <Toolbar sx={{ gap: 2, minHeight: 64 }}>
        <Tooltip title="Go to Live Map (reloads to the default view)">
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.25}
            onClick={() => {
              // Deliberately a full browser navigation, not `navigate()` -
              // LiveMapPage keeps its state/district/layer selections in
              // local component state (not the URL), so a client-side
              // `navigate(ROUTES.liveMap)` while already on that route
              // wouldn't remount the page or clear any of it. A real reload
              // is what actually resets to the default Live Map view, which
              // is the explicit ask here (clicking the logo = go home, fresh).
              window.location.assign(ROUTES.liveMap);
            }}
            role="button"
            aria-label={`${COMPANY_NAME} - go to Live Map (reloads to the default view)`}
            sx={{ flexShrink: 0, cursor: 'pointer' }}
          >
            <Box
              component="img"
              src={bkcLogo}
              alt={`${COMPANY_NAME} logo`}
              sx={{ height: 34, width: 'auto', display: 'block' }}
            />
            <Stack sx={{ display: { xs: 'none', sm: 'flex' }, lineHeight: 1.1 }}>
              <Typography variant="h6" fontWeight={800} noWrap sx={{ lineHeight: 1.1 }}>
                {COMPANY_NAME}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ lineHeight: 1.1 }}>
                {COMPANY_TAGLINE}
              </Typography>
            </Stack>
          </Stack>
        </Tooltip>

        <LiveBadge />

        <Box sx={{ flexGrow: 1, minWidth: 0, overflow: 'auto' }}>
          <Tabs
            value={activeTab}
            onChange={(_e, value: string) => {
              if (value === ROUTES.hazards) {
                setHazardsNoticeOpen(true);
                return;
              }
              navigate(value);
            }}
            variant="scrollable"
            scrollButtons="auto"
            textColor="primary"
            indicatorColor="primary"
          >
            {NAV_ITEMS.map((item) => (
              <Tab
                key={item.to}
                value={item.to}
                icon={item.icon}
                iconPosition="start"
                label={item.label}
                sx={{ minHeight: 48, fontWeight: 600 }}
              />
            ))}
          </Tabs>
        </Box>

        <Stack direction="row" alignItems="center" spacing={2} sx={{ flexShrink: 0 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: { xs: 'none', md: 'block' }, fontVariantNumeric: 'tabular-nums' }}
          >
            {now.format('DD MMM YYYY')} &bull; {now.format('HH:mm:ss')}
          </Typography>
          <Tooltip title={unread && unread.count > 0 ? `${unread.count} unread alert(s)` : 'Notifications'}>
            <span>
              <NotificationMenu />
            </span>
          </Tooltip>
          <LogoutButton />
          <ProfileMenu />
        </Stack>
      </Toolbar>

      <Dialog open={hazardsNoticeOpen} onClose={() => setHazardsNoticeOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ConstructionRoundedIcon color="warning" />
          Hazards &mdash; Work in Progress
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            This section is currently under development and isn&apos;t ready for use yet. We&apos;re actively
            building out real cyclone, flood and advisory data feeds for it. Please check back soon.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" onClick={() => setHazardsNoticeOpen(false)}>
            Got it
          </Button>
        </DialogActions>
      </Dialog>
    </AppBar>
  );
}
