import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import type { ReactNode } from 'react';

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" flexWrap="wrap" gap={1.5} alignItems="center">
        {children}
      </Stack>
    </Paper>
  );
}
