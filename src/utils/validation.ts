import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional(),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const profileSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Enter a valid email address'),
  phone: z
    .string()
    .regex(/^[0-9+\-\s]{7,15}$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
  designation: z.string().optional(),
});
export type ProfileFormValues = z.infer<typeof profileSchema>;

export const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Full name is required'),
    username: z.string().min(3, 'Username must be at least 3 characters'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    email: z.string().email('Enter a valid email address'),
    phone: z.string().regex(/^[0-9+\-\s]{7,15}$/, 'Enter a valid phone number'),
    designation: z.string().optional(),
    // Account type - picked by the registrant themselves. 'admin' gets
    // unrestricted Pan-India access with no approval step; see
    // RegisterPayload's doc comment in features/auth/types.ts.
    role: z.enum(['admin', 'viewer'], { errorMap: () => ({ message: 'Select an account type' }) }),
    // Location - which state/district's tower alerts this user should receive.
    state: z.string().min(1, 'Select a state'),
    district: z.string().min(1, 'Select a district'),
    // Notification channels - at least one must be enabled, otherwise
    // registering a location has nothing to deliver alerts through.
    notifyWhatsapp: z.boolean(),
    notifySms: z.boolean(),
    notifyEmail: z.boolean(),
    whatsappNumber: z
      .string()
      .regex(/^[0-9+\-\s]{7,15}$/, 'Enter a valid WhatsApp number')
      .optional()
      .or(z.literal('')),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.notifyWhatsapp || data.notifySms || data.notifyEmail, {
    message: 'Select at least one channel to receive tower alerts on',
    path: ['notifyEmail'],
  })
  .refine((data) => !data.notifyWhatsapp || Boolean(data.whatsappNumber), {
    message: 'Enter a WhatsApp number, or uncheck WhatsApp alerts',
    path: ['whatsappNumber'],
  });
export type RegisterFormValues = z.infer<typeof registerSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm the new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export const forgotPasswordSchema = z
  .object({
    username: z.string().min(3, 'Username must be at least 3 characters'),
    phone: z.string().regex(/^[0-9+\-\s]{7,15}$/, 'Enter the phone number on your account'),
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const reportRequestSchema = z.object({
  title: z.string().min(3, 'Title is required'),
  siteIds: z.array(z.string()).min(1, 'Select at least one site'),
  parameters: z.array(z.string()).min(1, 'Select at least one parameter'),
  dateFrom: z.string().min(1, 'Start date is required'),
  dateTo: z.string().min(1, 'End date is required'),
  format: z.enum(['pdf', 'csv', 'xlsx']),
});
export type ReportRequestFormValues = z.infer<typeof reportRequestSchema>;
