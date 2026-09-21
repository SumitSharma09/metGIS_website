import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import { useResetPasswordMutation } from '@/features/auth/authApi';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '@/utils/validation';
import { ROUTES } from '@/routes/routePaths';
import { COMPANY_NAME, COMPANY_TAGLINE } from '@/utils/branding';
import bkcLogo from '@/assets/branding/bkc-weathersys-logo.png';

/**
 * Self-service password reset. There's no email/SMS delivery infra behind
 * this app, so identity is proven the low-friction way instead: the
 * username plus the phone number captured at registration. If both match
 * an account, the new password is set immediately - see
 * AuthService#resetPassword (backend) / resetMockUserPassword (mock mode).
 */
export default function ForgotPasswordPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [resetPassword, { isLoading }] = useResetPasswordMutation();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { username: '', phone: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setFormError(null);
    try {
      await resetPassword(values).unwrap();
      setSuccess(true);
      setTimeout(() => navigate(ROUTES.login, { replace: true }), 2000);
    } catch (err) {
      const message = (err as { message?: string })?.message ?? 'Unable to reset password. Please try again.';
      setFormError(message);
    }
  };

  return (
    <Card elevation={12} sx={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1, borderRadius: 4 }}>
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
            Enter your username and the phone number on your account to set a new password
          </Typography>
        </Stack>

        {formError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFormError(null)}>
            {formError}
          </Alert>
        )}

        {success ? (
          <Alert severity="success">Password reset. Redirecting you to sign in&hellip;</Alert>
        ) : (
          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack spacing={2.5}>
              <Controller
                name="username"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Username"
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
                name="phone"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Phone Number"
                    placeholder="+91 98765 43210"
                    fullWidth
                    error={Boolean(errors.phone)}
                    helperText={errors.phone?.message ?? 'The phone number you registered with'}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PhoneRoundedIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />
              <Controller
                name="newPassword"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="New Password"
                    type={showPassword ? 'text' : 'password'}
                    fullWidth
                    error={Boolean(errors.newPassword)}
                    helperText={errors.newPassword?.message}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockRoundedIcon fontSize="small" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowPassword((v) => !v)} edge="end">
                            {showPassword ? (
                              <VisibilityOffRoundedIcon fontSize="small" />
                            ) : (
                              <VisibilityRoundedIcon fontSize="small" />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />
              <Controller
                name="confirmPassword"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Confirm New Password"
                    type={showPassword ? 'text' : 'password'}
                    fullWidth
                    error={Boolean(errors.confirmPassword)}
                    helperText={errors.confirmPassword?.message}
                  />
                )}
              />

              <Button type="submit" variant="contained" size="large" fullWidth disabled={isLoading}>
                {isLoading ? <CircularProgress size={22} color="inherit" /> : 'Reset Password'}
              </Button>
            </Stack>
          </Box>
        )}

        <Divider sx={{ my: 3 }} />
        <Typography variant="body2" textAlign="center">
          <Link component={RouterLink} to={ROUTES.login}>
            Back to sign in
          </Link>
        </Typography>
      </CardContent>
    </Card>
  );
}
