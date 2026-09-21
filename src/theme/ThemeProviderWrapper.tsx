import { useMemo, type ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useAppSelector } from '@/app/hooks';
import { buildTheme } from './theme';

export function ThemeProviderWrapper({ children }: { children: ReactNode }) {
  const mode = useAppSelector((s) => s.ui.themeMode);
  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
