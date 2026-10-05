import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { THEME_MODE_STORAGE_KEY } from '@/utils/constants';

type ThemeMode = 'light' | 'dark';

interface UiState {
  themeMode: ThemeMode;
}

function loadInitialThemeMode(): ThemeMode {
  const stored = localStorage.getItem(THEME_MODE_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  // Changed 2026-09-21 (on request: "dashboard open default in light mode
  // not in dark mode in every system") - light is now the default for a
  // first-time visitor on any machine/browser, regardless of that system's
  // OS/browser dark-mode preference. The user can still switch to dark from
  // the settings menu, and that choice is remembered per-browser via
  // THEME_MODE_STORAGE_KEY exactly as before - this only changes what a
  // browser with no stored preference yet sees first.
  return 'light';
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
