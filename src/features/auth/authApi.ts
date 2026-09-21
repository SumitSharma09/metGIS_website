import { apiSlice } from '@/api/apiSlice';
import { restRequest, isMockMode } from '@/api/queryHelpers';
import { mockResponse, mockError, delay } from '@/api/mock/db';
import { findUserByCredentials, findUserByUsername, registerMockUser, resetMockUserPassword } from '@/api/mock/data/users';
import type {
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  RegisterResponse,
  ForgotPasswordPayload,
  ForgotPasswordResponse,
} from './types';

/**
 * REST contract (used once VITE_USE_MOCK_API=false):
 *   POST /auth/login            { username, password }         -> { token, user }
 *   POST /auth/logout           (Authorization header only)     -> 204
 *   POST /auth/register         { ...RegisterPayload }          -> { token, user }
 *   POST /auth/forgot-password  { username, phone, newPassword } -> { success }
 */
export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginPayload>({
      queryFn: async (payload) => {
        if (isMockMode) {
          const user = findUserByCredentials(payload.username, payload.password);
          if (!user) {
            try {
              await mockError(401, 'Invalid username or password');
            } catch (error) {
              return { error: error as { status: number; message: string } };
            }
          }
          const { password: _password, ...profile } = user!;
          const data = await mockResponse<LoginResponse>({
            token: `mock-token-${profile.id}-${Date.now()}`,
            user: profile,
          });
          return { data };
        }
        return restRequest<LoginResponse>({ url: '/auth/login', method: 'POST', data: payload });
      },
    }),
    logout: builder.mutation<void, void>({
      queryFn: async () => {
        if (isMockMode) {
          await delay(150);
          return { data: undefined };
        }
        return restRequest<void>({ url: '/auth/logout', method: 'POST' });
      },
    }),
    register: builder.mutation<RegisterResponse, RegisterPayload>({
      queryFn: async (payload) => {
        if (isMockMode) {
          if (findUserByUsername(payload.username)) {
            try {
              await mockError(409, 'That username is already taken');
            } catch (error) {
              return { error: error as { status: number; message: string } };
            }
          }
          const user = registerMockUser(payload);
          const { password: _password, ...profile } = user;
          const data = await mockResponse<RegisterResponse>({
            token: `mock-token-${profile.id}-${Date.now()}`,
            user: profile,
          });
          return { data };
        }
        return restRequest<RegisterResponse>({ url: '/auth/register', method: 'POST', data: payload });
      },
      // So an already-mounted Hazards page's useListUsersQuery() picks up
      // the new registrant (and their location/notification preferences)
      // as a possible alert recipient without needing a full page reload.
      invalidatesTags: ['User'],
    }),
    resetPassword: builder.mutation<ForgotPasswordResponse, ForgotPasswordPayload>({
      queryFn: async (payload) => {
        if (isMockMode) {
          const ok = resetMockUserPassword(payload.username, payload.phone, payload.newPassword);
          if (!ok) {
            try {
              await mockError(400, "Username and phone number don't match our records");
            } catch (error) {
              return { error: error as { status: number; message: string } };
            }
          }
          const data = await mockResponse<ForgotPasswordResponse>({ success: true });
          return { data };
        }
        return restRequest<ForgotPasswordResponse>({ url: '/auth/forgot-password', method: 'POST', data: payload });
      },
    }),
  }),
});

export const { useLoginMutation, useLogoutMutation, useRegisterMutation, useResetPasswordMutation } = authApi;
