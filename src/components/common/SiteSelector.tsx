import { useMemo } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import { useListSitesQuery } from '@/features/sites/sitesApi';
import type { Site } from '@/features/sites/types';

// Fixed 2026-09-24: this was `pageSize: 100`, which silently truncated both
// selectors below to whichever ~100 sites happened to sort first from the
// backend - on the real (non-mock) API, most districts nationwide never
// appeared as options at all. Same fix already applied to the Reports
// section's tables/exports (SITE_PAGE_SIZE = 100000 there) - no backend
// upper cap, so every real site/district is fetched.
const SITE_PAGE_SIZE = 100000;

interface SingleSiteSelectorProps {
  value: string | null;
  onChange: (siteId: string | null) => void;
  label?: string;
  size?: 'small' | 'medium';
}

export function SiteSelector({ value, onChange, label = 'Site', size = 'small' }: SingleSiteSelectorProps) {
  const { data, isLoading } = useListSitesQuery({ pageSize: SITE_PAGE_SIZE });
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

/**
 * Fixed 2026-09-24: this used to list every individual site as its own
 * option. Once the pageSize fix above started returning every real site
 * nationwide, that meant the same district name reappeared once per tower
 * under it (a district with 40 towers showed up as 40 near-identical rows) -
 * unusable for picking coverage. This now shows each district exactly once
 * (matching the Districts Risk Report's own grain), and picking a district
 * still resolves to every site id under it behind the scenes, so the
 * `siteIds` payload the backend expects is unchanged.
 */
export function MultiSiteSelector({ value, onChange, label = 'Districts' }: MultiSiteSelectorProps) {
  const { data, isLoading } = useListSitesQuery({ pageSize: SITE_PAGE_SIZE });
  const sites = data?.items ?? [];

  const districtToSiteIds = useMemo(() => {
    const map = new Map<string, string[]>();
    sites.forEach((s) => {
      if (!s.district) return;
      const ids = map.get(s.district) ?? [];
      ids.push(s.id);
      map.set(s.district, ids);
    });
    return map;
  }, [sites]);

  const districts = useMemo(() => [...districtToSiteIds.keys()].sort(), [districtToSiteIds]);

  // A district reads as "selected" only once every one of its site ids is
  // present in `value` - so a partially-covered district (shouldn't normally
  // happen since selecting always adds/removes a whole district at once)
  // doesn't render as a false positive.
  const selectedDistricts = districts.filter((d) => {
    const ids = districtToSiteIds.get(d) ?? [];
    return ids.length > 0 && ids.every((id) => value.includes(id));
  });

  const handleChange = (newDistricts: string[]) => {
    onChange(newDistricts.flatMap((d) => districtToSiteIds.get(d) ?? []));
  };

  return (
    <Autocomplete
      multiple
      size="small"
      options={districts}
      value={selectedDistricts}
      loading={isLoading}
      onChange={(_e, newValue: string[]) => handleChange(newValue)}
      sx={{ minWidth: 260 }}
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  );
}
