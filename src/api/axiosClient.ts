import axios, { AxiosError } from 'axios';
import { API_BASE_URL, AUTH_TOKEN_STORAGE_KEY } from '@/utils/constants';
import type { ApiError } from '@/types/common';

// Single axios instance used for every real backend call (mock mode bypasses
// this entirely - see src/api/queryHelpers.ts). Centralizing it here means
// auth headers, base URL and error shape only need to be handled once.
export const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  // Was 20000 (20s) - fine for the old ~20-demo-site dataset and most
  // circle-scoped real requests, but the Daily National Bulletin now
  // requests weather for EVERY real tower nationwide in one call (57,000+
  // as of 2026-09) - the backend chunks that into dozens of sequential
  // database queries (2,000 ids per chunk), which can legitimately take
  // longer than 20s to finish. A request that was silently timing out
  // looked identical to "no real data" in the UI (both just leave the
  // bulletin's matrices empty), which made a genuine timeout very hard to
  // tell apart from a real data gap. Bumped well above what even a
  // full-India request should need; a request that's actually broken will
  // still fail, just with more headroom before this gives up on a slow-but-
  // working one.
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    const apiError: ApiError = {
      status: error.response?.status ?? 0,
      message: error.response?.data?.message ?? error.message ?? 'Unexpected network error',
    };

    if (apiError.status === 401) {
      // Token expired / invalid - clear local session. The auth slice's
      // subscription to storage (or a dispatched logout on next render)
      // takes care of redirecting to /login.
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }

    return Promise.reject(apiError);
  }
);
