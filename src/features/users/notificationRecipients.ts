import type { UserProfile } from './types';

/**
 * Matches registered users to a circle's tower alert, using the location
 * captured at registration (see UserLocation's doc comment in types.ts).
 *
 * This is a frontend-only mock app with no real WhatsApp Business API/SMS
 * gateway/SMTP integration behind it, so this - and everything built on
 * top of it (the Hazards page's "Registered Recipients" preview) - only
 * identifies WHO would be notified and on WHICH channels; it never
 * actually sends anything. Swap this for a real notification-service call
 * once one exists.
 */
export function findRecipientsForCircle(users: UserProfile[], circle: string): UserProfile[] {
  if (!circle) return [];
  return users.filter((u) => u.location?.circle === circle);
}

export interface RecipientChannelCounts {
  whatsapp: number;
  sms: number;
  email: number;
  total: number;
}

export function summarizeChannels(recipients: UserProfile[]): RecipientChannelCounts {
  return {
    whatsapp: recipients.filter((u) => u.notificationPreferences?.whatsapp).length,
    sms: recipients.filter((u) => u.notificationPreferences?.sms).length,
    email: recipients.filter((u) => u.notificationPreferences?.email).length,
    total: recipients.length,
  };
}
