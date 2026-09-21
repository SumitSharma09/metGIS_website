import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { useListDistrictsQuery } from '@/features/sites/sitesApi';
import { useScopedStates } from '@/features/users/useScopedStates';

interface MapControlsProps {
  state: string | null;
  onChangeState: (state: string | null) => void;
  district: string | null;
  onChangeDistrict: (district: string | null) => void;
  /** Every state/UT the signed-in user is allowed to pick that also has at
   *  least one real monitored site (LiveMapPage's `stateOptions`, from
   *  `useVisibleStates()` - RBAC intersected with `useListStatesQuery()`). */
  stateOptions: string[];
}

/**
 * Region drill-down (state -> district), each level locked until the one
 * above it is picked - matching the reference product's cascading
 * dropdowns rather than letting district be searched nationwide before a
 * state is chosen. Parameter selection, basemap, and the wind toggle used
 * to live in this same panel, but now live in the top-left
 * `ParameterToolbar` and top-right `MapViewControls` instead - matching the
 * reference product's icon-button toolbars - so this panel is just the
 * region picker now. The Tehsil dropdown that used to sit below District
 * has been removed per explicit request - district is now the finest level
 * pickable from here (a district can still be drilled into further by
 * clicking it directly on the choropleth).
 */
export function MapControls({
  state,
  onChangeState,
  district,
  onChangeDistrict,
  stateOptions,
}: MapControlsProps) {
  // Real, monitored districts only - this used to be widened with every
  // administrative district from the government boundary dataset, which
  // listed districts with zero real towers alongside actual ones. See the
  // matching fix in useDistrictBoundaries.ts's useVisibleStates() for the
  // same class of issue on the State dropdown above.
  const { data: districts = [] } = useListDistrictsQuery(state ?? undefined, { skip: !state });
  const { isPanIndia, assignedStates } = useScopedStates();

  return (
    <Paper
      elevation={4}
      sx={{
        position: 'absolute',
        top: 68,
        left: 12,
        zIndex: 900,
        p: 1.5,
        width: 240,
        backgroundColor: 'background.paper',
        opacity: 0.97,
      }}
    >
      <Typography variant="caption" fontWeight={700} color="text.secondary">
        REGION
      </Typography>
      <Stack spacing={1.5} sx={{ mt: 1 }}>
        <Autocomplete
          size="small"
          options={stateOptions}
          value={state}
          onChange={(_e, value) => {
            onChangeState(value);
            onChangeDistrict(null);
          }}
          renderInput={(params) => <TextField {...params} label="State" />}
        />
        <Autocomplete
          size="small"
          options={districts}
          value={district}
          disabled={!state}
          onChange={(_e, value) => onChangeDistrict(value)}
          renderInput={(params) => <TextField {...params} label={state ? 'District' : 'Select state first'} />}
        />
        <Typography variant="caption" color="text.secondary">
          Tip: click a district on the map to select it too.
        </Typography>
        {!isPanIndia && (
          <Chip
            size="small"
            variant="outlined"
            color="primary"
            icon={<LockRoundedIcon fontSize="small" />}
            label={`Scoped to: ${assignedStates.join(', ') || 'none assigned'}`}
            sx={{ alignSelf: 'flex-start' }}
          />
        )}
      </Stack>
    </Paper>
  );
}
