import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'We couldn’t load this data. Please try again.',
  onRetry,
}: ErrorStateProps) {
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
      <ErrorOutlineRoundedIcon color="error" sx={{ fontSize: 40 }} />
      <Typography variant="subtitle1" color="text.primary" fontWeight={600}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ maxWidth: 360 }}>
        {message}
      </Typography>
      {onRetry && (
        <Button variant="outlined" size="small" onClick={onRetry} sx={{ mt: 1 }}>
          Try again
        </Button>
      )}
    </Box>
  );
}
