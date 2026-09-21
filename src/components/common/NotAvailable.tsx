import Tooltip from '@mui/material/Tooltip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

interface NotAvailableProps {
  /** Tooltip explaining *why* - keep this specific ("no hourly_weather rows
   *  for this tower yet", "cyclone tracking data isn't connected yet")
   *  rather than a generic fallback, since that's what turns "broken" into
   *  "understood" for whoever's reading the dashboard. */
  reason?: string;
  /** Inline variant for a table cell or a value slot inside running text -
   *  drops the icon and takes on the surrounding text's variant/size
   *  instead of setting its own. Default (false) is the small standalone
   *  form used in a StatCard/StatBox value slot. */
  inline?: boolean;
}

/**
 * The one place in the app that renders "this parameter has no real data
 * right now" - used everywhere a stat tile, table cell, or chart would
 * otherwise have to show a fabricated number or a bare 0/blank. Muted and
 * explicitly worded (never a bare "--" or "N/A") so it reads as "the
 * pipeline hasn't produced this yet," not as a broken page or a real
 * reading of zero.
 */
export function NotAvailable({ reason = 'No live data for this yet', inline = false }: NotAvailableProps) {
  const content = inline ? (
    <Typography component="span" variant="inherit" color="text.disabled" sx={{ fontStyle: 'italic' }}>
      Not currently available
    </Typography>
  ) : (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'text.disabled' }}>
      <InfoOutlinedIcon sx={{ fontSize: 14 }} />
      <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
        Not currently available
      </Typography>
    </Stack>
  );
  return (
    <Tooltip title={reason} arrow placement="top">
      <span>{content}</span>
    </Tooltip>
  );
}
