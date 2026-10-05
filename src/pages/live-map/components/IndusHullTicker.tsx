import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { keyframes, useTheme } from '@mui/material/styles';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

/**
 * Scrolling disclaimer strip shown directly above the timeline scrubber,
 * only in the Indus/Towers view's district shapes (see DistrictHullLayer.tsx)
 * - moved here from a plain small Chip per explicit request ("change this is
 * ticker type above timeline like"). Same scrolling-ticker pattern as
 * DemoModeTicker.tsx (duplicated text track + a reduced-motion static
 * fallback), just styled as a rounded Paper strip to match this map's other
 * floating controls (TimelineScrubber, MapViewControls) instead of
 * DemoModeTicker's own full-width top-of-page bar.
 *
 * Says exactly what the Chip it replaces said - this view's district shapes
 * connect each district's own tower locations rather than showing the real
 * government boundary (which DistrictLayer still draws with Indus/Towers
 * switched off) - so a viewer doesn't mistake the hull shape for that same
 * official data.
 */
const scroll = keyframes`
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
`;

const TICKER_TEXT =
  "District shapes here connect this district's own tower locations - approximate, not the official boundary";

export function IndusHullTicker() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const bg = isDark ? '#4a3300' : '#fff4d6';
  const fg = isDark ? '#ffd166' : '#7a4b00';
  const border = isDark ? '#7a5600' : '#f0c96b';

  return (
    <Paper
      elevation={4}
      role="status"
      aria-label={TICKER_TEXT}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        height: 30,
        px: 1.5,
        borderRadius: 2.5,
        bgcolor: bg,
        color: fg,
        border: `1px solid ${border}`,
        overflow: 'hidden',
      }}
    >
      <InfoOutlinedIcon sx={{ fontSize: 16, flexShrink: 0 }} aria-hidden />
      <Box sx={{ position: 'relative', flex: 1, minWidth: 0, height: '100%' }} aria-hidden>
        {/* Static fallback - shown by default, and whenever the viewer has
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
            lineHeight: '30px',
            '@media (prefers-reduced-motion: no-preference)': { display: 'none' },
          }}
        >
          {TICKER_TEXT}
        </Box>
        {/* Scrolling track - only enabled when motion is not reduced. Text is
            duplicated back-to-back so the loop reads as continuous. */}
        <Box
          sx={{
            display: 'none',
            '@media (prefers-reduced-motion: no-preference)': {
              display: 'flex',
              width: 'max-content',
              animation: `${scroll} 22s linear infinite`,
            },
          }}
        >
          <Box
            component="span"
            sx={{ whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, letterSpacing: 0.2, lineHeight: '30px', pr: 6 }}
          >
            {TICKER_TEXT}
          </Box>
          <Box
            component="span"
            sx={{ whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, letterSpacing: 0.2, lineHeight: '30px', pr: 6 }}
          >
            {TICKER_TEXT}
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}
