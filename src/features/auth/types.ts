import type { UserProfile, UserLocation, NotificationPreferences } from '@/features/users/types';

export interface LoginPayload {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  token: string;
  user: UserProfile;
}

/**
 * `role` is picked by the registrant themselves at sign-up: 'admin' gets
 * unrestricted Pan-India access to every alert/state/data (no
 * `assignedStates` scoping applied), 'viewer' only ever sees the one state
 * picked in `location` below. There's no invite/approval step - whichever
 * the registrant picks is what they get immediately. `assignedStates` is
 * narrowed to the registration state for 'viewer' accounts only. Location
 * and notification preferences are what let the Hazards page's
 * "Registered Recipients" preview match this user to tower alerts for
 * their district. */
export interface RegisterPayload {
  username: string;
  password: string;
  fullName: string;
  email: string;
  phone: string;
  designation?: string;
  role: 'admin' | 'viewer';
  location: UserLocation;
  notificationPreferences: NotificationPreferences;
}

export type RegisterResponse = LoginResponse;

/**
 * Self-service password reset - identity is proven with username + the
 * phone number on file (no email/SMS delivery infra behind this app), then
 * the new password is set directly. See AuthService#resetPassword.
 */
export interface ForgotPasswordPayload {
  username: string;
  phone: string;
  newPassword: string;
}

export interface ForgotPasswordResponse {
  success: boolean;
}
