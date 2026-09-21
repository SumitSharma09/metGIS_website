import Box from '@mui/material/Box';
import { keyframes, useTheme } from '@mui/material/styles';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { isMockMode } from '@/api/queryHelpers';

/**
 * Small, always-visible disclaimer strip shown above the Live Map only while
 * the app is running on its built-in mock data (VITE_USE_MOCK_API=true) -
 * e.g. the 500 programmatically-generated demo towers in
 * api/mock/data/sites.ts. Never rendered against the real Indus/MySQL
 * backend (isMockMode is false there), since that data isn't a demo and
 * shouldn't carry this caveat.
 *
 * Scrolls (a classic "ticker") only when the viewer hasn't asked their OS/
 * browser for reduced motion - see the `no-preference` media queries below,
 * the same accessibility pattern already used by ForecastSkyAnimation.tsx.
 * With reduced motion on, a single static, ellipsis-truncated line is shown
 * instead of forcing any movement.
 */
const scroll = keyframes`
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
`;

const TICKER_TEXT =
  'DEMO MODE — This Live Map is running on simulated tower and weather data for demonstration purposes only. Some parameters are estimated, and real data may be incomplete or missing.';

export function DemoModeTicker() {
  const theme = useTheme();
  if (!isMockMode) return null;

  const isDark = theme.palette.mode === 'dark';
  const bg = isDark ? '#4a3300' : '#fff4d6';
  const fg = isDark ? '#ffd166' : '#7a4b00';
  const border = isDark ? '#7a5600' : '#f0c96b';

  return (
    <Box
      role="status"
      aria-label={TICKER_TEXT}
      sx={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        height: 28,
        px: 1.5,
        bgcolor: bg,
        color: fg,
        borderBottom: `1px solid ${border}`,
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1201, // above Leaflet's own panes/controls (max ~1000)
      }}
    >
      <WarningAmberRoundedIcon sx={{ fontSize: 16, flexShrink: 0 }} aria-hidden />
      <Box sx={{ position: 'relative', flex: 1, minWidth: 0, height: '100%' }} aria-hidden>
        {/* Static fallback: shown by default, and whenever the viewer has
            asked for reduced motion. */}
        <Box
          component="span"
          sx={{
            display: 'block',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.2,
            lineHeight: '28px',
            '@media (prefers-reduced-motion: no-preference)': { display: 'none' },
          }}
        >
          {TICKER_TEXT}
        </Box>
        {/* Scrolling track: only enabled when motion is not reduced. Text is
            duplicated back-to-back so the loop reads as continuous. */}
        <Box
          sx={{
            display: 'none',
            '@media (prefers-reduced-motion: no-preference)': {
              display: 'flex',
              width: 'max-content',
              animation: `${scroll} 26s linear infinite`,
            },
          }}
        >
          <Box
            component="span"
            sx={{ whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, letterSpacing: 0.2, lineHeight: '28px', pr: 6 }}
          >
            {TICKER_TEXT}
          </Box>
          <Box
            component="span"
            sx={{ whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, letterSpacing: 0.2, lineHeight: '28px', pr: 6 }}
          >
            {TICKER_TEXT}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
