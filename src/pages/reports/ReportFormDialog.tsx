import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormHelperText from '@mui/material/FormHelperText';
import CircularProgress from '@mui/material/CircularProgress';
import { MultiSiteSelector } from '@/components/common/SiteSelector';
import { reportRequestSchema, type ReportRequestFormValues } from '@/utils/validation';
import { WEATHER_PARAMETERS } from '@/utils/constants';

interface ReportFormDialogProps {
  open: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: ReportRequestFormValues) => void;
}

export function ReportFormDialog({ open, submitting, onClose, onSubmit }: ReportFormDialogProps) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReportRequestFormValues>({
    resolver: zodResolver(reportRequestSchema),
    defaultValues: {
      title: '',
      siteIds: [],
      parameters: ['temperature', 'rainfall'],
      dateFrom: '',
      dateTo: '',
      format: 'pdf',
    },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = (values: ReportRequestFormValues) => {
    onSubmit(values);
    reset();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={700}>Generate New Report</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ mt: 0.5 }}>
          <Controller
            name="title"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Report Title" fullWidth error={Boolean(errors.title)} helperText={errors.title?.message} />
            )}
          />
          <Controller
            name="siteIds"
            control={control}
            render={({ field }) => (
              <Stack spacing={0.5}>
                <MultiSiteSelector value={field.value} onChange={field.onChange} />
                {errors.siteIds && <FormHelperText error>{errors.siteIds.message}</FormHelperText>}
              </Stack>
            )}
          />
          <Controller
            name="parameters"
            control={control}
            render={({ field }) => (
              <Stack spacing={1}>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {WEATHER_PARAMETERS.map((param) => {
                    const active = field.value.includes(param.value);
                    return (
                      <Chip
                        key={param.value}
                        label={param.label}
                        size="small"
                        color={active ? 'primary' : 'default'}
                        variant={active ? 'filled' : 'outlined'}
                        onClick={() =>
                          field.onChange(
                            active ? field.value.filter((p) => p !== param.value) : [...field.value, param.value]
                          )
                        }
                      />
                    );
                  })}
                </Stack>
                {errors.parameters && <FormHelperText error>{errors.parameters.message}</FormHelperText>}
              </Stack>
            )}
          />
          <Stack direction="row" spacing={2}>
            <Controller
              name="dateFrom"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="date"
                  label="From"
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  error={Boolean(errors.dateFrom)}
                  helperText={errors.dateFrom?.message}
                />
              )}
            />
            <Controller
              name="dateTo"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="date"
                  label="To"
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  error={Boolean(errors.dateTo)}
                  helperText={errors.dateTo?.message}
                />
              )}
            />
          </Stack>
          <Controller
            name="format"
            control={control}
            render={({ field }) => (
              <TextField {...field} select label="Format" sx={{ maxWidth: 200 }}>
                <MenuItem value="pdf">PDF</MenuItem>
                <MenuItem value="csv">CSV</MenuItem>
                <MenuItem value="xlsx">Excel (XLSX)</MenuItem>
              </TextField>
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSubmit(submit)} variant="contained" disabled={submitting}>
          {submitting ? <CircularProgress size={20} color="inherit" /> : 'Generate Report'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
