import { useState, type MouseEvent } from 'react';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import { useNavigate } from 'react-router-dom';
import { useGetUnreadAlertCountQuery, useListAlertsQuery, useMarkAlertReadMutation } from '@/features/alerts/alertsApi';
import { SeverityChip } from '@/components/common/StatusChip';
import { formatRelative } from '@/utils/formatters';
import { ROUTES } from '@/routes/routePaths';
import { EmptyState } from '@/components/common/EmptyState';

export function NotificationMenu() {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const navigate = useNavigate();
  const { data: unread } = useGetUnreadAlertCountQuery();
  const { data: alertsPage } = useListAlertsQuery({ page: 1, pageSize: 6 }, { skip: !anchorEl });
  const [markAlertRead] = useMarkAlertReadMutation();

  const open = Boolean(anchorEl);

  const handleOpen = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  return (
    <>
      <IconButton onClick={handleOpen}>
        <Badge color="error" badgeContent={unread?.count ?? 0} max={99}>
          <NotificationsRoundedIcon />
        </Badge>
      </IconButton>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose} PaperProps={{ sx: { width: 380, maxHeight: 480 } }}>
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            Notifications
          </Typography>
        </Box>
        <Divider />
        {!alertsPage || alertsPage.items.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <EmptyState title="No notifications" message="You're all caught up." />
          </Box>
        ) : (
          alertsPage.items.map((alert) => (
            <MenuItem
              key={alert.id}
              onClick={() => {
                markAlertRead(alert.id);
                handleClose();
                navigate(ROUTES.alerts);
              }}
              sx={{ whiteSpace: 'normal', py: 1.25, opacity: alert.read ? 0.6 : 1 }}
            >
              <Stack spacing={0.5} sx={{ width: '100%' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <SeverityChip severity={alert.severity} />
                  <Typography variant="caption" color="text.secondary">
                    {formatRelative(alert.triggeredAt)}
                  </Typography>
                </Stack>
                <Typography variant="body2">{alert.message}</Typography>
              </Stack>
            </MenuItem>
          ))
        )}
        <Divider />
        <Box sx={{ p: 1 }}>
          <Button
            fullWidth
            size="small"
            onClick={() => {
              handleClose();
              navigate(ROUTES.alerts);
            }}
          >
            View all alerts
          </Button>
        </Box>
      </Menu>
    </>
  );
}
