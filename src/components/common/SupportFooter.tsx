import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { COMPANY_NAME } from '@/utils/branding';

interface SupportFooterProps {
  /** 'light' is for a dark background (the auth screens - login/register/
   *  forgot password, all rendered over AuthLayout's dark gradient).
   *  'default' is for a normal light-theme surface (e.g. the Profile page,
   *  rendered inside the ordinary dashboard chrome). */
  variant?: 'light' | 'default';
}

const SUPPORT_EMAIL_INFO = 'info@weathersysbkc.com';
const SUPPORT_EMAIL_HELP = 'support@weathersysbkc.com';
const SUPPORT_PHONE_DISPLAY = '+91 98110 62673';
const SUPPORT_PHONE_TEL = '+919811062673';

/**
 * Developer attribution + support contact details, shown on the screens a
 * new or struggling user is most likely to need them from: sign-in,
 * registration, and account settings (see AuthLayout.tsx and
 * ProfilePage.tsx). Content and recipients here were given explicitly by
 * the operator - update this one file if either ever changes, nothing else
 * references these values.
 */
export function SupportFooter({ variant = 'light' }: SupportFooterProps) {
  const isLight = variant === 'light';
  const textColor = isLight ? 'rgba(255,255,255,0.65)' : 'text.secondary';
  const linkColor = isLight ? 'rgba(255,255,255,0.92)' : 'primary.main';

  return (
    <Box sx={{ textAlign: 'center', mt: isLight ? 0 : 4, width: '100%', maxWidth: 480 }}>
      <Divider sx={{ mb: 2, borderColor: isLight ? 'rgba(255,255,255,0.15)' : undefined }} />
      <Typography variant="caption" sx={{ color: textColor, display: 'block' }}>
        This portal is developed by Software Team &ndash; {COMPANY_NAME} Pvt. Ltd.
      </Typography>
      <Stack
        direction="row"
        spacing={1}
        justifyContent="center"
        flexWrap="wrap"
        rowGap={0.25}
        sx={{ mt: 0.5 }}
      >
        <Typography variant="caption" sx={{ color: textColor }}>
          Support for login &amp; registration:
        </Typography>
        <Link href={`mailto:${SUPPORT_EMAIL_INFO}`} variant="caption" sx={{ color: linkColor }}>
          {SUPPORT_EMAIL_INFO}
        </Link>
        <Typography variant="caption" sx={{ color: textColor }}>
          &middot;
        </Typography>
        <Link href={`mailto:${SUPPORT_EMAIL_HELP}`} variant="caption" sx={{ color: linkColor }}>
          {SUPPORT_EMAIL_HELP}
        </Link>
        <Typography variant="caption" sx={{ color: textColor }}>
          &middot;
        </Typography>
        <Link href={`tel:${SUPPORT_PHONE_TEL}`} variant="caption" sx={{ color: linkColor }}>
          {SUPPORT_PHONE_DISPLAY}
        </Link>
      </Stack>
    </Box>
  );
}
