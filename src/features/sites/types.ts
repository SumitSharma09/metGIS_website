import type { SiteStatus } from '@/utils/constants';

export interface Site {
  id: string;
  code: string;
  name: string;
  circle: string; // regional/telecom circle, e.g. "Mumbai", "Delhi NCR"
  state: string;
  district: string; // administrative district - used for the Live Map / Reports / Comparison drill-down
  // Sub-district area - see api/mock/data/sites.ts for why this mirrors the
  // site's own locality name rather than an official tehsil/taluka master
  // list, which isn't part of this app's data model yet.
  tehsil: string;
  latitude: number;
  longitude: number;
  address: string;
  status: SiteStatus;
  elevationMeters: number;
  installedOn: string; // ISO date
  contactPerson: string;
  contactPhone: string;
  towerType: 'GBT' | 'RTT' | 'Monopole';
}

export interface SiteListQuery {
  search?: string;
  circle?: string;
  state?: string;
  district?: string;
  tehsil?: string;
  status?: SiteStatus;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}
