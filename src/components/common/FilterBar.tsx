import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import type { ReactNode } from 'react';

// Card, not Paper (changed 2026-09-25) - Paper has no border-radius override
// of its own in theme.ts, so it was rendering at the theme's plain 10px
// `shape.borderRadius` while every StatCard/ChartCard/data-grid Card on the
// same page is explicitly set to 14px (`MuiCard` styleOverride). The filter
// bar's corners were visibly squarer than every card below it on every page
// that uses this component - a small but real "these don't look like one
// system" tell. `variant="outlined"` renders identically otherwise (Card is
// Paper plus the same outlined-border styling), so this is a pure
// corner-radius fix, not a visual behavior change.
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" flexWrap="wrap" gap={1.5} alignItems="center">
        {children}
      </Stack>
    </Card>
  );
}
