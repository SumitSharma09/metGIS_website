import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Alert from '@mui/material/Alert';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import { useAppDispatch } from '@/app/hooks';
import { setCredentials } from '@/features/auth/authSlice';
import { useLoginMutation } from '@/features/auth/authApi';
import { loginSchema, type LoginFormValues } from '@/utils/validation';
import { ROUTES } from '@/routes/routePaths';
import { COMPANY_NAME, COMPANY_TAGLINE } from '@/utils/branding';
import bkcLogo from '@/assets/branding/bkc-weathersys-logo.png';
import { ForecastSkyAnimation } from '@/components/auth/ForecastSkyAnimation';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [login, { isLoading }] = useLoginMutation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '', rememberMe: true },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null);
    try {
      const response = await login(values).unwrap();
      dispatch(setCredentials(response));
      const redirectTo = (location.state as { from?: { pathname: string } } | null)?.from?.pathname || ROUTES.liveMap;
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const message = (err as { message?: string })?.message ?? 'Unable to sign in. Please try again.';
      setFormError(message);
    }
  };

  return (
    <>
      {/* Forecast-themed animation as a full-page background behind the
          sign-in card - matching the reference product's login screen (a
          full-bleed scenic background behind a centered card), not a
          separate side panel. See ForecastSkyAnimation.tsx for why it's safe
          from a copyright standpoint (hand-authored inline SVG + CSS only, no
          stock video/image/icon asset of any kind) and how it stays
          responsive (`preserveAspectRatio="xMidYMid slice"` fills any
          viewport size/ratio without distortion). Fixed + zIndex 0 so it
          sits behind the card (zIndex 1 below) regardless of DOM order. */}
      <ForecastSkyAnimation fullBleed />

      <Card elevation={12} sx={{ width: '100%', maxWidth: 420, borderRadius: 4, position: 'relative', zIndex: 1 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack alignItems="center" spacing={0.5} sx={{ mb: 3 }}>
            <Box component="img" src={bkcLogo} alt={`${COMPANY_NAME} logo`} sx={{ height: 56, width: 'auto', mb: 1 }} />
            <Typography variant="h5" fontWeight={800}>
              {COMPANY_NAME}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
              {COMPANY_TAGLINE}
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Sign in to access the site weather monitoring dashboard
            </Typography>
          </Stack>

          {formError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFormError(null)}>
              {formError}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack spacing={2.5}>
              <Controller
                name="username"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Username"
                    placeholder="Enter username"
                    fullWidth
                    autoFocus
                    error={Boolean(errors.username)}
                    helperText={errors.username?.message}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonRoundedIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />
              <Controller
                name="password"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Password"
                    placeholder="Enter password"
                    type={showPassword ? 'text' : 'password'}
                    fullWidth
                    error={Boolean(errors.password)}
                    helperText={errors.password?.message}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockRoundedIcon fontSize="small" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowPassword((v) => !v)} edge="end">
                            {showPassword ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />

              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Controller
                  name="rememberMe"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Checkbox size="small" checked={field.value} onChange={field.onChange} />}
                      label={<Typography variant="body2">Remember me</Typography>}
                    />
                  )}
                />
                <Link component={RouterLink} to={ROUTES.forgotPassword} variant="body2">
                  Forgot password?
                </Link>
              </Stack>

              <Button type="submit" variant="contained" size="large" fullWidth disabled={isLoading}>
                {isLoading ? <CircularProgress size={22} color="inherit" /> : 'Sign in'}
              </Button>
            </Stack>
          </Box>

          <Typography variant="body2" textAlign="center" sx={{ mt: 2.5 }}>
            New user?{' '}
            <Link component={RouterLink} to={ROUTES.register}>
              Register to receive tower alerts
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </>
  );
}
