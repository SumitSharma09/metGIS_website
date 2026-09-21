import { MOCK_LATENCY_MS } from '@/utils/constants';
import type { PaginatedResult, PaginationParams, SortParams } from '@/types/common';

/** Simulates network latency so loading states are visible in the UI. */
export const delay = (ms: number = MOCK_LATENCY_MS): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function paginate<T>(items: T[], params: PaginationParams = {}): PaginatedResult<T> {
  const page = params.page && params.page > 0 ? params.page : 1;
  const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : 10;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return {
    items: items.slice(start, end),
    total: items.length,
    page,
    pageSize,
  };
}

export function sortItems<T extends object>(items: T[], sort?: SortParams): T[] {
  if (!sort?.sortBy) return items;
  const { sortBy, sortDir = 'asc' } = sort;
  const copy = [...items];
  copy.sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[sortBy];
    const bv = (b as unknown as Record<string, unknown>)[sortBy];
    if (av == null || bv == null) return 0;
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortDir === 'asc' ? av - bv : bv - av;
    }
    return sortDir === 'asc'
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });
  return copy;
}

export function textSearch<T>(items: T[], query: string | undefined, fields: (keyof T)[]): T[] {
  if (!query || !query.trim()) return items;
  const q = query.trim().toLowerCase();
  return items.filter((item) =>
    fields.some((field) => String(item[field] ?? '').toLowerCase().includes(q))
  );
}

/** Generic wrapper: simulate a network round-trip and return the given value. */
export async function mockResponse<T>(value: T, latencyMs?: number): Promise<T> {
  await delay(latencyMs);
  return value;
}

/** Simulate a failed request (e.g. wrong credentials, not found, server error). */
export async function mockError(status: number, message: string, latencyMs?: number): Promise<never> {
  await delay(latencyMs);
  const error = { status, message };
  throw error;
}
