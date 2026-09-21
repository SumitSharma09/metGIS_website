import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import SmsRoundedIcon from '@mui/icons-material/SmsRounded';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { RISK_COLOR, REPORT_RISK_LABEL } from '@/utils/severity';
import { findRecipientsForCircle, summarizeChannels } from '@/features/users/notificationRecipients';
import type { UserProfile } from '@/features/users/types';
import type { CurrentDayAdvisoryRow } from '../hazardData';

interface CurrentDayAdvisoryProps {
  rows: CurrentDayAdvisoryRow[];
  /** Every registered user (from useListUsersQuery) - matched to a row by
   *  circle to preview who'd receive that row's alert, and on which
   *  channels. See notificationRecipients.ts's doc comment: this is a
   *  mock preview only, there's no real message gateway wired up. */
  users: UserProfile[];
}

function RecipientsCell({ circle, users }: { circle: string; users: UserProfile[] }) {
  const recipients = findRecipientsForCircle(users, circle);
  const counts = summarizeChannels(recipients);

  if (counts.total === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        No registered recipients
      </Typography>
    );
  }

  const tooltip = (
    <Box>
      <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>
        {counts.total} registered user{counts.total === 1 ? '' : 's'} in {circle}
      </Typography>
      {recipients.map((u) => (
        <Typography key={u.id} variant="caption" sx={{ display: 'block' }}>
          {u.fullName}
          {!u.notificationPreferences?.whatsapp && !u.notificationPreferences?.sms && !u.notificationPreferences?.email
            ? ' (no channels enabled)'
            : ''}
        </Typography>
      ))}
    </Box>
  );

  return (
    <Tooltip title={tooltip} arrow>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ cursor: 'default' }}>
        {counts.whatsapp > 0 && (
          <Stack direction="row" spacing={0.25} alignItems="center">
            <WhatsAppIcon sx={{ fontSize: 15, color: '#25D366' }} />
            <Typography variant="caption">{counts.whatsapp}</Typography>
          </Stack>
        )}
        {counts.sms > 0 && (
          <Stack direction="row" spacing={0.25} alignItems="center">
            <SmsRoundedIcon sx={{ fontSize: 15 }} color="action" />
            <Typography variant="caption">{counts.sms}</Typography>
          </Stack>
        )}
        {counts.email > 0 && (
          <Stack direction="row" spacing={0.25} alignItems="center">
            <EmailRoundedIcon sx={{ fontSize: 15 }} color="action" />
            <Typography variant="caption">{counts.email}</Typography>
          </Stack>
        )}
      </Stack>
    </Tooltip>
  );
}

/** Today's line out of the weekly bulletin, on its own - the scope
 *  document's "Daily Weather Alerts Report" is meant to go out every day
 *  (Email/WhatsApp/portal), separately from the weekly monsoon-preparation
 *  one below it, so it gets its own compact table rather than being buried
 *  as just the first day-column of the weekly view. The Recipients column
 *  previews which registered users (by their registration-time circle) and
 *  channels this row's alert would go out on - see notificationRecipients.ts. */
export function CurrentDayAdvisory({ rows, users }: CurrentDayAdvisoryProps) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow sx={{ '& th': { backgroundColor: 'primary.main', color: 'primary.contrastText', fontWeight: 700 } }}>
            <TableCell>Region</TableCell>
            <TableCell>Circle</TableCell>
            <TableCell>Rainfall Outlook</TableCell>
            <TableCell>Wind/Thunderstorm Outlook</TableCell>
            <TableCell align="center">Severity</TableCell>
            <TableCell>Advisory</TableCell>
            <TableCell>Recipients</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.circle}>
              <TableCell>{row.region}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{row.circle}</TableCell>
              <TableCell>{row.rainfallOutlook}</TableCell>
              <TableCell>{row.windOutlook}</TableCell>
              <TableCell align="center" sx={{ p: 0.5 }}>
                <Box
                  sx={{
                    py: 0.5,
                    px: 1,
                    borderRadius: 1,
                    backgroundColor: RISK_COLOR[row.severity],
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 11,
                    display: 'inline-block',
                  }}
                >
                  {REPORT_RISK_LABEL[row.severity]}
                </Box>
              </TableCell>
              <TableCell sx={{ minWidth: 260, fontSize: 12.5 }}>{row.summary}</TableCell>
              <TableCell sx={{ minWidth: 140 }}>
                <RecipientsCell circle={row.circle} users={users} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
