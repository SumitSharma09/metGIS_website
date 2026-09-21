export type ReportFormat = 'pdf' | 'csv' | 'xlsx';
export type ReportStatus = 'ready' | 'processing' | 'failed';

export interface ReportItem {
  id: string;
  title: string;
  siteIds: string[];
  siteNames: string[];
  parameters: string[];
  dateFrom: string;
  dateTo: string;
  format: ReportFormat;
  status: ReportStatus;
  generatedBy: string;
  generatedAt: string;
  fileSizeKb: number;
}

export interface ReportListQuery {
  search?: string;
  status?: ReportStatus;
  page?: number;
  pageSize?: number;
}

export interface CreateReportPayload {
  title: string;
  siteIds: string[];
  parameters: string[];
  dateFrom: string;
  dateTo: string;
  format: ReportFormat;
}
