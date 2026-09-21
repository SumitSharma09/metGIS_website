import { apiSlice } from '@/api/apiSlice';
import { restRequest, isMockMode } from '@/api/queryHelpers';
import { mockResponse, mockError } from '@/api/mock/db';
import { findUserById, demoUsers } from '@/api/mock/data/users';
import type { UserProfile } from './types';
import type { ChangePasswordFormValues, ProfileFormValues } from '@/utils/validation';

/**
 * REST contract:
 *   GET  /users/:id                 -> UserProfile
 *   PUT  /users/:id                 -> UserProfile
 *   POST /users/:id/change-password -> 204
 */
export const usersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getUserById: builder.query<UserProfile, string>({
      queryFn: async (id) => {
        if (isMockMode) {
          const user = findUserById(id);
          if (!user) return { error: { status: 404, message: 'User not found' } };
          const { password: _password, ...profile } = user;
          const data = await mockResponse(profile);
          return { data };
        }
        return restRequest<UserProfile>({ url: `/users/${id}` });
      },
      providesTags: (_result, _error, id) => [{ type: 'User', id }],
    }),
    updateProfile: builder.mutation<UserProfile, { id: string; changes: ProfileFormValues }>({
      queryFn: async ({ id, changes }) => {
        if (isMockMode) {
          const user = findUserById(id);
          if (!user) return { error: { status: 404, message: 'User not found' } };
          Object.assign(user, {
            fullName: changes.fullName,
            email: changes.email,
            phone: changes.phone || user.phone,
            designation: changes.designation || user.designation,
          });
          const { password: _password, ...profile } = user;
          const data = await mockResponse(profile);
          return { data };
        }
        return restRequest<UserProfile>({ url: `/users/${id}`, method: 'PUT', data: changes });
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'User', id }],
    }),
    changePassword: builder.mutation<{ success: boolean }, { id: string; values: ChangePasswordFormValues }>({
      queryFn: async ({ id, values }) => {
        if (isMockMode) {
          const user = findUserById(id);
          if (!user) return { error: { status: 404, message: 'User not found' } };
          if (user.password !== values.currentPassword) {
            try {
              await mockError(400, 'Current password is incorrect');
            } catch (error) {
              return { error: error as { status: number; message: string } };
            }
          }
          user.password = values.newPassword;
          const data = await mockResponse({ success: true });
          return { data };
        }
        return restRequest<{ success: boolean }>({
          url: `/users/${id}/change-password`,
          method: 'POST',
          data: values,
        });
      },
    }),
    listUsers: builder.query<UserProfile[], void>({
      queryFn: async () => {
        if (isMockMode) {
          const data = await mockResponse(demoUsers.map(({ password: _p, ...rest }) => rest));
          return { data };
        }
        return restRequest<UserProfile[]>({ url: '/users' });
      },
      providesTags: ['User'],
    }),
  }),
});

export const {
  useGetUserByIdQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useListUsersQuery,
} = usersApi;
