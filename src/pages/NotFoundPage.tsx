import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/routes/routePaths';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        textAlign: 'center',
        p: 3,
      }}
    >
      <CloudOffRoundedIcon sx={{ fontSize: 56, color: 'text.disabled' }} />
      <Typography variant="h3" fontWeight={800}>
        404
      </Typography>
      <Typography variant="h6" fontWeight={600}>
        Page not found
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380 }}>
        The page you're looking for doesn't exist or has been moved.
      </Typography>
      <Button variant="contained" onClick={() => navigate(ROUTES.liveMap)}>
        Back to Live Map
      </Button>
    </Box>
  );
}
