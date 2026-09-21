/**
 * Single source of truth for the operator's company identity, used
 * everywhere the app needs to present itself professionally: the top nav
 * logo, and the letterhead printed on every PDF/Excel export (Tower Risk
 * Reports, Forecast vs Actual comparison).
 *
 * Update these three values (and swap the PNG in ./assets/branding/) if the
 * branding ever changes - nothing else needs to change.
 */
export const COMPANY_NAME = 'BKC WeatherSys';
export const COMPANY_TAGLINE = 'Integrated Systems since 1990';

/** Shown in export footers - adjust once the org can confirm exact wording. */
export const COMPANY_FOOTER_NOTE = 'Confidential - for internal operational use only';
