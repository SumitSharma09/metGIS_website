export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface SortParams {
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface ApiError {
  status: number;
  message: string;
  details?: unknown;
}

export interface DateRangeParams {
  from: string; // ISO date
  to: string; // ISO date
}

export type LoadState = 'idle' | 'loading' | 'succeeded' | 'failed';
