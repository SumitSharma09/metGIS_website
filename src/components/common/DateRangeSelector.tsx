import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { Dayjs } from 'dayjs';

interface DateRangeSelectorProps {
  from: string; // ISO date
  to: string; // ISO date
  onChange: (range: { from: string; to: string }) => void;
  maxDate?: Dayjs;
}

export function DateRangeSelector({ from, to, onChange, maxDate = dayjs() }: DateRangeSelectorProps) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
      <DatePicker
        label="From"
        value={dayjs(from)}
        maxDate={maxDate}
        onChange={(newValue) => {
          if (newValue) onChange({ from: newValue.format('YYYY-MM-DD'), to });
        }}
        slotProps={{ textField: { size: 'small' } }}
      />
      <Typography variant="body2" color="text.secondary">
        to
      </Typography>
      <DatePicker
        label="To"
        value={dayjs(to)}
        minDate={dayjs(from)}
        maxDate={maxDate}
        onChange={(newValue) => {
          if (newValue) onChange({ from, to: newValue.format('YYYY-MM-DD') });
        }}
        slotProps={{ textField: { size: 'small' } }}
      />
    </Stack>
  );
}
