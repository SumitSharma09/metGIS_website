import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { THEME_MODE_STORAGE_KEY } from '@/utils/constants';

type ThemeMode = 'light' | 'dark';

interface UiState {
  themeMode: ThemeMode;
}

function loadInitialThemeMode(): ThemeMode {
  const stored = localStorage.getItem(THEME_MODE_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  // The reference ops tool runs dark by default (control-room style,
  // low-glare map view) - default to dark rather than following the OS
  // preference, but still let the user override and remember it.
  return 'dark';
}

const initialState: UiState = {
  themeMode: loadInitialThemeMode(),
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleThemeMode: (state) => {
      state.themeMode = state.themeMode === 'light' ? 'dark' : 'light';
      localStorage.setItem(THEME_MODE_STORAGE_KEY, state.themeMode);
    },
    setThemeMode: (state, action: PayloadAction<ThemeMode>) => {
      state.themeMode = action.payload;
      localStorage.setItem(THEME_MODE_STORAGE_KEY, action.payload);
    },
  },
});

export const { toggleThemeMode, setThemeMode } = uiSlice.actions;
export default uiSlice.reducer;
