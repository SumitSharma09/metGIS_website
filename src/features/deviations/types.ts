export type DeviationSeverity = 'minor' | 'moderate' | 'major';

export type DeviationParameter = 'temperature' | 'rainfall' | 'windSpeed';

export interface DeviationAlert {
  id: string;
  siteId: string;
  siteName: string;
  forecastDate: string; // ISO date - the day the diverging forecasts are both for
  parameter: DeviationParameter;
  previousValue: number;
  updatedValue: number;
  deltaAbsolute: number;
  severity: DeviationSeverity;
  previousIssuedDate: string; // ISO date the earlier run was issued on
  updatedIssuedDate: string; // ISO date the later run was issued on
  detectedAt: string; // ISO datetime
  acknowledged: boolean;
  message: string;
}

export interface DeviationListQuery {
  siteId?: string;
  severity?: DeviationSeverity;
  page?: number;
  pageSize?: number;
}
