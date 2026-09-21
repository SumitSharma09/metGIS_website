import { createApi } from '@reduxjs/toolkit/query/react';
import { restBaseQuery } from './queryHelpers';

/**
 * Single RTK Query "api slice" for the whole app. Every feature under
 * src/features/*\/*.Api.ts calls `apiSlice.injectEndpoints(...)` instead of
 * creating its own `createApi`, so there is exactly one reducer
 * (`state.api`) and one middleware to wire into the store, while endpoint
 * definitions stay split by domain for readability.
 *
 * `baseQuery` here is only the fallback for endpoints that don't override it
 * with their own `queryFn` — in this app every endpoint provides a
 * `queryFn` that branches between the mock layer and `restBaseQuery`
 * (see src/api/queryHelpers.ts), so this default is effectively unused but
 * required by `createApi`'s types.
 */
export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: restBaseQuery,
  tagTypes: ['Site', 'Alert', 'Report', 'User', 'Dashboard', 'Deviation'],
  endpoints: () => ({}),
});
