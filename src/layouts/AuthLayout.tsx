import Box from '@mui/material/Box';
import { Outlet } from 'react-router-dom';
import { SupportFooter } from '@/components/common/SupportFooter';

export function AuthLayout() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        p: 2,
        position: 'relative',
        overflow: 'hidden',
        background:
          'radial-gradient(1200px circle at 10% 10%, rgba(37,99,235,0.35), transparent 45%),' +
          'radial-gradient(1200px circle at 90% 90%, rgba(14,165,164,0.30), transparent 45%),' +
          'linear-gradient(180deg, #0b1220 0%, #111a2c 100%)',
      }}
    >
      {/* Decorative animated cloud shapes - purely CSS, no external assets */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          opacity: 0.5,
        }}
      />
      <Outlet />
      {/* Developer attribution + login/registration support contact - shown
          on every screen this layout wraps (login, register, forgot
          password) per explicit request. See SupportFooter.tsx. */}
      <SupportFooter variant="light" />
    </Box>
  );
}
