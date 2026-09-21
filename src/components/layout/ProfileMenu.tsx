import { useState, type MouseEvent } from 'react';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { logout } from '@/features/auth/authSlice';
import { toggleThemeMode } from '@/features/ui/uiSlice';
import { useLogoutMutation } from '@/features/auth/authApi';
import { ROUTES } from '@/routes/routePaths';

/**
 * Settings-gear entry point that opens a menu combining account actions
 * (profile / sign out) with quick display settings (theme). Matches the
 * reference product's "gear icon in the top bar" pattern rather than a
 * bare avatar button.
 */
export function ProfileMenu() {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const user = useAppSelector((s) => s.auth.user);
  const themeMode = useAppSelector((s) => s.ui.themeMode);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [logoutRequest] = useLogoutMutation();

  const open = Boolean(anchorEl);
  const initials = user?.fullName
    ? user.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  const handleLogout = async () => {
    try {
      await logoutRequest().unwrap();
    } finally {
      dispatch(logout());
      navigate(ROUTES.login, { replace: true });
    }
  };

  return (
    <>
      <Tooltip title="Settings">
        <IconButton onClick={(e: MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)}>
          <SettingsRoundedIcon />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)} PaperProps={{ sx: { width: 280 } }}>
        <Box sx={{ px: 2, py: 1.5 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ width: 38, height: 38, bgcolor: 'primary.main', fontSize: 14 }}>{initials}</Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" fontWeight={700} noWrap>
                {user?.fullName ?? 'Guest User'}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {user?.email}
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            navigate(ROUTES.profile);
          }}
        >
          <ListItemIcon>
            <PersonRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>My Profile</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => dispatch(toggleThemeMode())}>
          <ListItemIcon>
            {themeMode === 'light' ? <DarkModeRoundedIcon fontSize="small" /> : <LightModeRoundedIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText>{themeMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutRoundedIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText sx={{ color: 'error.main' }}>Sign out</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
