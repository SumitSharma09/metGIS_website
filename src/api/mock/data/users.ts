import dayjs from 'dayjs';
import type { UserProfile } from '@/features/users/types';
import type { RegisterPayload } from '@/features/auth/types';

export const demoUsers: (UserProfile & { password: string })[] = [
  {
    id: 'user-1',
    username: 'admin',
    password: 'admin123',
    fullName: 'Sumit Sharma',
    email: 'sumit.javadeveloper09@gmail.com',
    phone: '+91 98200 12345',
    role: 'admin',
    designation: 'Network Operations Manager',
    lastLoginAt: dayjs().subtract(2, 'hour').toISOString(),
    assignedStates: [], // Pan-India
    // Pan-India admin has no single "home" circle to receive tower alerts
    // for, so no location/notificationPreferences here - see UserLocation's
    // doc comment in features/users/types.ts.
  },
  {
    id: 'user-2',
    username: 'operator',
    password: 'operator123',
    fullName: 'Priya Nair',
    email: 'priya.nair@example.com',
    phone: '+91 98450 67890',
    role: 'operator',
    designation: 'Field Operations Executive',
    lastLoginAt: dayjs().subtract(1, 'day').toISOString(),
    // Mirrors the Spring Boot DataSeeder's seeded operator scope.
    assignedStates: ['Delhi', 'Haryana'],
    // Illustrative registration data, so the Hazards page's "Registered
    // Recipients" preview has at least one match out of the box.
    location: { state: 'Delhi', district: 'New Delhi', circle: 'Delhi NCR' },
    notificationPreferences: { whatsapp: true, sms: true, email: true, whatsappNumber: '+91 98450 67890' },
  },
  {
    id: 'user-3',
    username: 'viewer',
    password: 'viewer123',
    fullName: 'Arjun Mehta',
    email: 'arjun.mehta@example.com',
    phone: '+91 98110 45678',
    role: 'viewer',
    designation: 'Regional Analyst',
    lastLoginAt: dayjs().subtract(5, 'day').toISOString(),
    // Mirrors the Spring Boot DataSeeder's seeded viewer scope.
    assignedStates: ['Karnataka'],
    location: { state: 'Karnataka', district: 'Bengaluru Urban', circle: 'Bangalore' },
    notificationPreferences: { whatsapp: false, sms: true, email: true },
  },
];

export const findUserByCredentials = (username: string, password: string) =>
  demoUsers.find((u) => u.username === username && u.password === password);

export const findUserById = (id: string) => demoUsers.find((u) => u.id === id);

export const findUserByUsername = (username: string) => demoUsers.find((u) => u.username === username);

/**
 * Mock-only "create account" - pushes a new self-service user into the
 * in-memory demoUsers array (there's no real persistence layer here, so
 * this resets on page reload, same as every other mock mutation in this
 * app). The registrant picks their own role (see RegisterPayload's doc
 * comment) - 'admin' gets Pan-India access (no assignedStates scoping),
 * 'viewer' is scoped to their own registration state.
 */
export function registerMockUser(payload: RegisterPayload): UserProfile & { password: string } {
  const user: UserProfile & { password: string } = {
    id: `user-${demoUsers.length + 1}-${Date.now()}`,
    username: payload.username,
    password: payload.password,
    fullName: payload.fullName,
    email: payload.email,
    phone: payload.phone,
    role: payload.role,
    designation: payload.designation || 'Registered User',
    lastLoginAt: dayjs().toISOString(),
    assignedStates: payload.role === 'admin' ? [] : [payload.location.state],
    location: payload.location,
    notificationPreferences: payload.notificationPreferences,
  };
  demoUsers.push(user);
  return user;
}

/** Loose digits-only comparison so "+91 98765 43210" matches "9876543210" -
 *  same normalization the real backend's AuthService#resetPassword uses. */
const normalizePhone = (phone: string) => phone.replace(/\D/g, '').slice(-10);

/**
 * Mock-only "forgot password" - proves identity with username + the phone
 * number on file (no email/SMS delivery infra behind this app), then sets
 * the new password directly on the in-memory record. Returns false without
 * saying which part didn't match, mirroring the real backend's generic
 * error (avoids revealing whether the username exists).
 */
export function resetMockUserPassword(username: string, phone: string, newPassword: string): boolean {
  const user = demoUsers.find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (!user || normalizePhone(user.phone) !== normalizePhone(phone)) {
    return false;
  }
  user.password = newPassword;
  return true;
}
