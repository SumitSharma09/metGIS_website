import { createTheme, type ThemeOptions, type PaletteMode } from '@mui/material/styles';

const getDesignTokens = (mode: PaletteMode): ThemeOptions => ({
  palette: {
    mode,
    primary: {
      main: '#2563eb',
      light: '#60a5fa',
      dark: '#1e40af',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#0ea5a4',
    },
    error: { main: '#dc2626' },
    warning: { main: '#d97706' },
    success: { main: '#16a34a' },
    info: { main: '#0284c7' },
    ...(mode === 'light'
      ? {
          background: {
            default: '#f4f6fb',
            paper: '#ffffff',
          },
          text: {
            primary: '#111827',
            secondary: '#4b5563',
          },
        }
      : {
          background: {
            default: '#0b1220',
            paper: '#111a2c',
          },
          text: {
            primary: '#e5e7eb',
            secondary: '#9ca3af',
          },
        }),
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily: ['Inter', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'].join(','),
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 14,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 700 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
  },
});

export const buildTheme = (mode: PaletteMode) => createTheme(getDesignTokens(mode));

// Semantic colors for weather / alert severity, kept outside the MUI palette
// so charts and status chips can reference a stable, theme-independent scale.
export const severityColors: Record<string, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  moderate: '#d97706',
  low: '#65a30d',
  info: '#0284c7',
};

export const chartSeriesColors = ['#2563eb', '#0ea5a4', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];
