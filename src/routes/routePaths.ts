export const ROUTES = {
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  // Primary top-nav sections (match the operational tool: map-first, not a card dashboard)
  liveMap: '/live-map',
  alerts: '/alerts',
  reports: '/reports',
  comparison: '/comparison',
  hazards: '/hazards',
  profile: '/profile',
  // Legacy / secondary routes kept for reuse (e.g. SiteDetailPage opened from a map marker)
  // and backward compatibility. Not shown in the primary top nav.
  dashboard: '/dashboard',
  sites: '/sites',
  siteDetail: (id: string) => `/sites/${id}`,
  observations: '/observations',
  historical: '/historical',
  forecast: '/forecast',
  notFound: '/404',
} as const;
