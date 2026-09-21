export type UserRole = 'admin' | 'operator' | 'viewer';

/**
 * Where a user actually is, for alert *delivery* - distinct from
 * `assignedStates` below, which is an RBAC *data-scoping* rule (which
 * states' sites/alerts/reports this user is allowed to see). A user's
 * location is the one circle/district whose tower alerts should actually
 * be pushed to them by WhatsApp/SMS/email, captured once at registration.
 */
export interface UserLocation {
  state: string;
  district: string;
  /** Telecom/regional circle (matches `Site.circle`, e.g. "Delhi NCR",
   *  "Bangalore"). No longer collected at registration (only state/
   *  district are asked now), so this is undefined for anyone who
   *  registered after that change - findRecipientsForCircle simply won't
   *  match them by circle. Kept optional rather than removed since older
   *  accounts/seed data still carry it. */
  circle?: string;
}

/**
 * Which channels a user wants tower alerts pushed through, captured at
 * registration. There's no real WhatsApp Business API / SMS gateway / SMTP
 * integration behind this app (it's a frontend-only mock) - these flags
 * only drive the "Registered Recipients" preview on the Hazards page
 * (see notificationRecipients.ts), they don't actually dispatch anything.
 */
export interface NotificationPreferences {
  whatsapp: boolean;
  sms: boolean;
  email: boolean;
  /** Only meaningful when `whatsapp` is true - separate from `phone` since
   *  a user's WhatsApp number can differ from their primary contact number. */
  whatsappNumber?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  designation: string;
  avatarUrl?: string;
  lastLoginAt: string;
  /**
   * States this user is restricted to (scope doc section 5, RBAC by
   * state/circle/district). An 'admin' is always Pan-India regardless of
   * this list; for 'operator'/'viewer' it's the exact set that should
   * narrow every state dropdown and, on the mock backend, every list of
   * sites/alerts/reports. Undefined/empty means unrestricted.
   */
  assignedStates?: string[];
  /** Captured at registration - see UserLocation's own doc comment for how
   *  this differs from `assignedStates`. Undefined for users registered
   *  before this field existed (e.g. the seeded admin account). */
  location?: UserLocation;
  /** Captured at registration - see NotificationPreferences's own doc
   *  comment. Undefined for users registered before this field existed. */
  notificationPreferences?: NotificationPreferences;
}
