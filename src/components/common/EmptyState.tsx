import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title = 'Nothing here yet',
  message = 'There’s no data to show for the current filters.',
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        py: 8,
        gap: 1.5,
        color: 'text.secondary',
      }}
    >
      {icon ?? <InboxRoundedIcon sx={{ fontSize: 40, opacity: 0.5 }} />}
      <Typography variant="subtitle1" color="text.primary" fontWeight={600}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ maxWidth: 360 }}>
        {message}
      </Typography>
      {actionLabel && onAction && (
        <Button variant="contained" size="small" onClick={onAction} sx={{ mt: 1 }}>
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}
