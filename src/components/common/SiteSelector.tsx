import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import { useListSitesQuery } from '@/features/sites/sitesApi';
import type { Site } from '@/features/sites/types';

interface SingleSiteSelectorProps {
  value: string | null;
  onChange: (siteId: string | null) => void;
  label?: string;
  size?: 'small' | 'medium';
}

export function SiteSelector({ value, onChange, label = 'Site', size = 'small' }: SingleSiteSelectorProps) {
  const { data, isLoading } = useListSitesQuery({ pageSize: 100 });
  const options = data?.items ?? [];
  const selected = options.find((s) => s.id === value) ?? null;

  return (
    <Autocomplete
      size={size}
      options={options}
      value={selected}
      loading={isLoading}
      onChange={(_e, newValue: Site | null) => onChange(newValue?.id ?? null)}
      getOptionLabel={(opt) => opt.name}
      isOptionEqualToValue={(opt, val) => opt.id === val.id}
      sx={{ minWidth: 220 }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {isLoading ? <CircularProgress size={16} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}

interface MultiSiteSelectorProps {
  value: string[];
  onChange: (siteIds: string[]) => void;
  label?: string;
}

export function MultiSiteSelector({ value, onChange, label = 'Sites' }: MultiSiteSelectorProps) {
  const { data, isLoading } = useListSitesQuery({ pageSize: 100 });
  const options = data?.items ?? [];
  const selected = options.filter((s) => value.includes(s.id));

  return (
    <Autocomplete
      multiple
      size="small"
      options={options}
      value={selected}
      loading={isLoading}
      onChange={(_e, newValue: Site[]) => onChange(newValue.map((s) => s.id))}
      getOptionLabel={(opt) => opt.name}
      isOptionEqualToValue={(opt, val) => opt.id === val.id}
      sx={{ minWidth: 260 }}
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  );
}
