export interface GlobalSearchResult {
  sites: { id: string; label: string; sublabel: string }[];
  alerts: { id: string; label: string; sublabel: string }[];
  reports: { id: string; label: string; sublabel: string }[];
}
