import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSnackbar } from 'notistack';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Divider from '@mui/material/Divider';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingState } from '@/components/common/LoadingState';
import { SupportFooter } from '@/components/common/SupportFooter';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { updateUser } from '@/features/auth/authSlice';
import { useGetUserByIdQuery, useUpdateProfileMutation, useChangePasswordMutation } from '@/features/users/usersApi';
import { profileSchema, changePasswordSchema, type ProfileFormValues, type ChangePasswordFormValues } from '@/utils/validation';
import { formatDateTime } from '@/utils/formatters';

export default function ProfilePage() {
  const [tab, setTab] = useState(0);
  const authUser = useAppSelector((s) => s.auth.user);
  const { data: user, isLoading } = useGetUserByIdQuery(authUser?.id ?? '', { skip: !authUser });

  if (isLoading || !user) return <LoadingState label="Loading profile..." />;

  return (
    <Stack spacing={2}>
      <PageHeader title="My Profile" description="Manage your account details and security settings" />

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Avatar sx={{ width: 84, height: 84, mx: 'auto', mb: 2, bgcolor: 'primary.main', fontSize: 28 }}>
                {user.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
              </Avatar>
              <Typography variant="h6" fontWeight={700}>
                {user.fullName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user.designation}
              </Typography>
              <Chip label={user.role} size="small" sx={{ mt: 1, textTransform: 'capitalize' }} color="primary" variant="outlined" />
              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" color="text.secondary" display="block">
                Last login
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {formatDateTime(user.lastLoginAt)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card variant="outlined">
            <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Tab label="Profile Details" />
              <Tab label="Security" />
            </Tabs>
            <CardContent sx={{ p: 3 }}>
              {tab === 0 ? <ProfileForm user={user} /> : <PasswordForm userId={user.id} />}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box display="flex" justifyContent="center">
        <SupportFooter variant="default" />
      </Box>
    </Stack>
  );
}

function ProfileForm({ user }: { user: { id: string; fullName: string; email: string; phone: string; designation: string } }) {
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: user.fullName, email: user.email, phone: user.phone, designation: user.designation },
  });

  useEffect(() => {
    reset({ fullName: user.fullName, email: user.email, phone: user.phone, designation: user.designation });
  }, [user, reset]);

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      const updated = await updateProfile({ id: user.id, changes: values }).unwrap();
      dispatch(updateUser(updated));
      enqueueSnackbar('Profile updated successfully', { variant: 'success' });
    } catch {
      enqueueSnackbar('Failed to update profile', { variant: 'error' });
    }
  };

  return (
    <Stack component="form" spacing={2.5} onSubmit={handleSubmit(onSubmit)} noValidate sx={{ maxWidth: 480 }}>
      <Controller
        name="fullName"
        control={control}
        render={({ field }) => <TextField {...field} label="Full Name" fullWidth error={Boolean(errors.fullName)} helperText={errors.fullName?.message} />}
      />
      <Controller
        name="email"
        control={control}
        render={({ field }) => <TextField {...field} label="Email" fullWidth error={Boolean(errors.email)} helperText={errors.email?.message} />}
      />
      <Controller
        name="phone"
        control={control}
        render={({ field }) => <TextField {...field} label="Phone" fullWidth error={Boolean(errors.phone)} helperText={errors.phone?.message} />}
      />
      <Controller
        name="designation"
        control={control}
        render={({ field }) => <TextField {...field} label="Designation" fullWidth />}
      />
      <Stack direction="row" spacing={1.5}>
        <Button type="submit" variant="contained" disabled={!isDirty || isLoading}>
          Save Changes
        </Button>
        <Button type="button" color="inherit" disabled={!isDirty} onClick={() => reset()}>
          Discard
        </Button>
      </Stack>
    </Stack>
  );
}

function PasswordForm({ userId }: { userId: string }) {
  const { enqueueSnackbar } = useSnackbar();
  const [changePassword, { isLoading }] = useChangePasswordMutation();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (values: ChangePasswordFormValues) => {
    try {
      await changePassword({ id: userId, values }).unwrap();
      enqueueSnackbar('Password changed successfully', { variant: 'success' });
      reset();
    } catch (err) {
      enqueueSnackbar((err as { message?: string })?.message ?? 'Failed to change password', { variant: 'error' });
    }
  };

  return (
    <Stack component="form" spacing={2.5} onSubmit={handleSubmit(onSubmit)} noValidate sx={{ maxWidth: 420 }}>
      <Controller
        name="currentPassword"
        control={control}
        render={({ field }) => (
          <TextField {...field} type="password" label="Current Password" fullWidth error={Boolean(errors.currentPassword)} helperText={errors.currentPassword?.message} />
        )}
      />
      <Controller
        name="newPassword"
        control={control}
        render={({ field }) => (
          <TextField {...field} type="password" label="New Password" fullWidth error={Boolean(errors.newPassword)} helperText={errors.newPassword?.message} />
        )}
      />
      <Controller
        name="confirmPassword"
        control={control}
        render={({ field }) => (
          <TextField {...field} type="password" label="Confirm New Password" fullWidth error={Boolean(errors.confirmPassword)} helperText={errors.confirmPassword?.message} />
        )}
      />
      <Button type="submit" variant="contained" disabled={isLoading} sx={{ alignSelf: 'flex-start' }}>
        Update Password
      </Button>
    </Stack>
  );
}
