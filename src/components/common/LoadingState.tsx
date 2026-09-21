import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, gap: 2 }}>
      <CircularProgress size={32} />
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

/** Skeleton rows for tables/lists while data is loading, instead of a spinner jump. */
export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <Stack spacing={1} sx={{ py: 1 }}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <Stack key={rowIndex} direction="row" spacing={2}>
          {Array.from({ length: columns }).map((__, colIndex) => (
            <Skeleton key={colIndex} variant="rounded" height={28} sx={{ flex: 1 }} />
          ))}
        </Stack>
      ))}
    </Stack>
  );
}

export function CardSkeleton({ height = 120 }: { height?: number }) {
  return <Skeleton variant="rounded" height={height} sx={{ borderRadius: 3 }} />;
}
