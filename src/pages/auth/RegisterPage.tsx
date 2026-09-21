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
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormHelperText from '@mui/material/FormHelperText';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Alert from '@mui/material/Alert';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import SmsRoundedIcon from '@mui/icons-material/SmsRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import { useAppDispatch } from '@/app/hooks';
import { setCredentials } from '@/features/auth/authSlice';
import { useRegisterMutation } from '@/features/auth/authApi';
import { useListStatesQuery, useListDistrictsQuery } from '@/features/sites/sitesApi';
import { registerSchema, type RegisterFormValues } from '@/utils/validation';
import { ROUTES } from '@/routes/routePaths';
import { COMPANY_NAME, COMPANY_TAGLINE } from '@/utils/branding';
import bkcLogo from '@/assets/branding/bkc-weathersys-logo.png';

/**
 * Self-service registration - the registrant picks their own account type
 * (Administrator = unrestricted Pan-India access, Normal User = scoped to
 * one state - see the "role" field in utils/validation.ts's registerSchema
 * and authApi.ts's register mutation), then captures where they are
 * (state/district) and how they want tower alerts pushed to them
 * (WhatsApp/SMS/Email), so the Hazards page's advisories can identify who
 * to notify. See features/users/types.ts's UserLocation/
 * NotificationPreferences doc comments, and notificationRecipients.ts for
 * where this data gets used.
 */
export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [register, { isLoading }] = useRegisterMutation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      username: '',
      password: '',
      confirmPassword: '',
      email: '',
      phone: '',
      designation: '',
      role: 'viewer',
      state: '',
      district: '',
      notifyWhatsapp: false,
      notifySms: true,
      notifyEmail: true,
      whatsappNumber: '',
    },
  });

  const selectedState = watch('state');
  const notifyWhatsapp = watch('notifyWhatsapp');
  const phone = watch('phone');

  const { data: states = [] } = useListStatesQuery();
  const { data: districts = [] } = useListDistrictsQuery(selectedState || undefined, { skip: !selectedState });

  const onSubmit = async (values: RegisterFormValues) => {
    setFormError(null);
    try {
      const response = await register({
        username: values.username,
        password: values.password,
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        designation: values.designation,
        role: values.role,
        location: { state: values.state, district: values.district },
        notificationPreferences: {
          whatsapp: values.notifyWhatsapp,
          sms: values.notifySms,
          email: values.notifyEmail,
          whatsappNumber: values.notifyWhatsapp ? values.whatsappNumber || values.phone : undefined,
        },
      }).unwrap();
      dispatch(setCredentials(response));
      navigate(ROUTES.liveMap, { replace: true });
    } catch (err) {
      const message = (err as { message?: string })?.message ?? 'Unable to register. Please try again.';
      setFormError(message);
    }
  };

  return (
    <Card elevation={12} sx={{ width: '100%', maxWidth: 560, position: 'relative', zIndex: 1, borderRadius: 4 }}>
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
            Register to receive tower weather alerts for your location
          </Typography>
        </Stack>

        {formError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFormError(null)}>
            {formError}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack spacing={2.5}>
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
              Account
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Controller
                name="fullName"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Full Name"
                    fullWidth
                    autoFocus
                    error={Boolean(errors.fullName)}
                    helperText={errors.fullName?.message}
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
                name="username"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Username"
                    fullWidth
                    error={Boolean(errors.username)}
                    helperText={errors.username?.message}
                  />
                )}
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Controller
                name="password"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Password"
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
                    label="Confirm Password"
                    type={showPassword ? 'text' : 'password'}
                    fullWidth
                    error={Boolean(errors.confirmPassword)}
                    helperText={errors.confirmPassword?.message}
                  />
                )}
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Email"
                    fullWidth
                    error={Boolean(errors.email)}
                    helperText={errors.email?.message}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailRoundedIcon fontSize="small" />
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
                    label="Mobile Number"
                    placeholder="+91 98765 43210"
                    fullWidth
                    error={Boolean(errors.phone)}
                    helperText={errors.phone?.message}
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
            </Stack>

            <Controller
              name="designation"
              control={control}
              render={({ field }) => <TextField {...field} label="Designation (optional)" fullWidth />}
            />

            <Divider />
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
              Account Type
            </Typography>
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <>
                  <ToggleButtonGroup
                    value={field.value}
                    exclusive
                    fullWidth
                    color="primary"
                    onChange={(_e, value) => {
                      if (value) field.onChange(value);
                    }}
                  >
                    <ToggleButton value="viewer">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <PersonOutlineRoundedIcon fontSize="small" />
                        <span>Normal User</span>
                      </Stack>
                    </ToggleButton>
                    <ToggleButton value="admin">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <AdminPanelSettingsRoundedIcon fontSize="small" />
                        <span>Administrator</span>
                      </Stack>
                    </ToggleButton>
                  </ToggleButtonGroup>
                  <FormHelperText error={Boolean(errors.role)}>
                    {errors.role?.message ??
                      (field.value === 'admin'
                        ? 'Full access to every state’s alerts, notifications and data'
                        : 'Access limited to the state you select below')}
                  </FormHelperText>
                </>
              )}
            />

            <Divider />
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
              Your Location
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: -1.5 }}>
              Tower weather alerts for this district will be sent to you on the channels you pick below
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Controller
                name="state"
                control={control}
                render={({ field }) => (
                  <Autocomplete
                    options={states}
                    value={field.value || null}
                    onChange={(_e, value) => {
                      field.onChange(value ?? '');
                      setValue('district', '');
                    }}
                    fullWidth
                    renderInput={(params) => (
                      <TextField {...params} label="State" error={Boolean(errors.state)} helperText={errors.state?.message} />
                    )}
                  />
                )}
              />
              <Controller
                name="district"
                control={control}
                render={({ field }) => (
                  <Autocomplete
                    options={districts}
                    value={field.value || null}
                    disabled={!selectedState}
                    onChange={(_e, value) => field.onChange(value ?? '')}
                    fullWidth
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="District"
                        error={Boolean(errors.district)}
                        helperText={errors.district?.message}
                      />
                    )}
                  />
                )}
              />
            </Stack>

            <Divider />
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
              Alert Channels
            </Typography>
            {errors.notifyEmail && (
              <Alert severity="warning" sx={{ py: 0 }}>
                {errors.notifyEmail.message}
              </Alert>
            )}
            <FormGroup>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Controller
                  name="notifyEmail"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Checkbox checked={field.value} onChange={field.onChange} icon={<EmailRoundedIcon />} checkedIcon={<EmailRoundedIcon color="primary" />} />}
                      label="Email"
                    />
                  )}
                />
                <Controller
                  name="notifySms"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Checkbox checked={field.value} onChange={field.onChange} icon={<SmsRoundedIcon />} checkedIcon={<SmsRoundedIcon color="primary" />} />}
                      label="SMS"
                    />
                  )}
                />
                <Controller
                  name="notifyWhatsapp"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Checkbox checked={field.value} onChange={field.onChange} icon={<WhatsAppIcon />} checkedIcon={<WhatsAppIcon sx={{ color: '#25D366' }} />} />}
                      label="WhatsApp"
                    />
                  )}
                />
              </Stack>
            </FormGroup>

            {notifyWhatsapp && (
              <Controller
                name="whatsappNumber"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="WhatsApp Number"
                    placeholder={phone || '+91 98765 43210'}
                    fullWidth
                    error={Boolean(errors.whatsappNumber)}
                    helperText={errors.whatsappNumber?.message || 'Leave blank to use your mobile number above'}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <WhatsAppIcon fontSize="small" sx={{ color: '#25D366' }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />
            )}

            <Button type="submit" variant="contained" size="large" fullWidth disabled={isLoading} sx={{ mt: 1 }}>
              {isLoading ? <CircularProgress size={22} color="inherit" /> : 'Create Account'}
            </Button>
          </Stack>
        </Box>

        <Divider sx={{ my: 3 }} />
        <Typography variant="body2" textAlign="center">
          Already have an account?{' '}
          <Link component={RouterLink} to={ROUTES.login}>
            Sign in
          </Link>
        </Typography>
      </CardContent>
    </Card>
  );
}
