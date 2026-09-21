import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from '@/utils/constants';
import type { UserProfile } from '@/features/users/types';

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
}

function loadInitialUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

const initialToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
const initialUser = loadInitialUser();

const initialState: AuthState = {
  token: initialToken,
  user: initialUser,
  isAuthenticated: Boolean(initialToken && initialUser),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<{ token: string; user: UserProfile }>) => {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, action.payload.token);
      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(action.payload.user));
    },
    updateUser: (state, action: PayloadAction<UserProfile>) => {
      state.user = action.payload;
      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(action.payload));
    },
    logout: (state) => {
      state.token = null;
      state.user = null;
      state.isAuthenticated = false;
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    },
  },
});

export const { setCredentials, updateUser, logout } = authSlice.actions;
export default authSlice.reducer;
