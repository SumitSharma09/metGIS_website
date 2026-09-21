import type { BaseQueryFn } from '@reduxjs/toolkit/query/react';
import { axiosClient } from './axiosClient';
import { USE_MOCK_API } from '@/utils/constants';
import type { ApiError } from '@/types/common';
import type { RootState } from '@/app/store';
import type { UserProfile } from '@/features/users/types';

interface RequestArgs {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: unknown;
  params?: unknown;
}

export type QueryFnResult<T> = { data: T } | { error: ApiError };

/**
 * Typed REST call used inside every endpoint's `queryFn` for its "real
 * backend" branch (the mock branch calls the mock data module directly).
 *
 * Every endpoint in this app is defined with `queryFn` rather than `query`,
 * so it can branch between:
 *   - the in-memory mock layer (src/api/mock/**) when VITE_USE_MOCK_API=true
 *   - a real REST call through axiosClient when it's false
 *
 * Being generic over the expected response type `T` means each endpoint
 * gets a correctly-typed result without needing an `as` cast, while the
 * REST contract (documented next to each endpoint) stays explicit and easy
 * to hand to a backend team. Switching to a live backend is then a single
 * env var flip once the API described in README.md is available.
 */
export async function restRequest<T>({ url, method = 'GET', data, params }: RequestArgs): Promise<QueryFnResult<T>> {
  try {
    const result = await axiosClient.request<T>({ url, method, data, params });
    return { data: result.data };
  } catch (err) {
    return { error: err as ApiError };
  }
}

/**
 * Generic fallback baseQuery required by `createApi`. Unused in practice
 * since every endpoint in this app supplies its own `queryFn` (see
 * restRequest above), but createApi's types require a baseQuery function.
 */
export const restBaseQuery: BaseQueryFn<RequestArgs, unknown, ApiError> = async (args) => restRequest(args);

export const isMockMode = USE_MOCK_API;

/**
 * Reads the signed-in user out of the RTK Query `api` callback argument
 * (`queryFn`'s 2nd param) so the mock-mode branch of an endpoint can apply
 * the same RBAC scoping (src/utils/accessScope.ts) the real backend applies
 * server-side. Untyped `getState()` is cast to `RootState` here so callers
 * don't each need the cast.
 */
export function currentMockUser(api: { getState: () => unknown }): UserProfile | null {
  return (api.getState() as RootState).auth.user;
}
