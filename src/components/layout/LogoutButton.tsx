import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/app/hooks';
import { logout } from '@/features/auth/authSlice';
import { useLogoutMutation } from '@/features/auth/authApi';
import { ROUTES } from '@/routes/routePaths';

/**
 * A direct, one-click "sign out" icon sitting in the top bar itself -
 * matching the reference product's own dedicated exit button - rather than
 * only being reachable two clicks deep inside the settings-gear menu.
 * `ProfileMenu` keeps its own "Sign out" entry too (some people expect it
 * there), so both paths clear the same mock credentials/token and land on
 * the login page.
 */
export function LogoutButton() {
  const [loggingOut, setLoggingOut] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [logoutRequest] = useLogoutMutation();

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutRequest().unwrap();
    } finally {
      dispatch(logout());
      navigate(ROUTES.login, { replace: true });
    }
  };

  return (
    <Tooltip title="Sign out">
      <span>
        <IconButton onClick={handleLogout} disabled={loggingOut} aria-label="Sign out" color="inherit">
          {loggingOut ? <CircularProgress size={18} /> : <LogoutRoundedIcon />}
        </IconButton>
      </span>
    </Tooltip>
  );
}
