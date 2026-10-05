import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { useListDistrictsReferenceQuery } from '@/features/sites/sitesApi';
import { useScopedStates } from '@/features/users/useScopedStates';
import { normalizeName } from '@/utils/districtRisk';

interface MapControlsProps {
  state: string | null;
  onChangeState: (state: string | null) => void;
  district: string | null;
  onChangeDistrict: (district: string | null) => void;
  /** Every state/UT the signed-in user is allowed to pick that also has at
   *  least one real monitored site (LiveMapPage's `stateOptions`, from
   *  `useVisibleStates()` - RBAC intersected with `useListStatesQuery()`). */
  stateOptions: string[];
  /** normalizeName(real state name) -> the actual raw `Site.state` (circle)
   *  value to filter by (see `buildStateSourceMap` in districtRisk.ts).
   *  `stateOptions` only ever lists plain real government state names
   *  ("Madhya Pradesh"), never a combined circle's raw value ("Madhya
   *  Pradesh & Chhattisgarh") - picking one from this dropdown without
   *  resolving through this map would filter every downstream query
   *  (sites, district list) by a value no site actually has, silently
   *  returning nothing. */
  stateSourceMap?: Map<string, string>;
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
  stateSourceMap,
}: MapControlsProps) {
  // Sourced from the curated indus_districts reference table (added
  // 2026-10-04), not derived from whatever free-text District spelling
  // happens to exist among real towers - see sitesApi.ts's own comment and
  // claude/live-map-indus-district-hull-replacement.md for why (a real
  // Rajgarh/Raigarh mix-up was traced back to trusting the tower-derived
  // list here). Note this can now list a district with zero current live
  // towers, unlike the old tower-derived list - that's expected: it's this
  // table's real district list for the state, not a "has data" filter.
  const { data: districts = [] } = useListDistrictsReferenceQuery(state ?? undefined, { skip: !state });
  const { isPanIndia, assignedStates } = useScopedStates();

  // `state` (the prop, and what every downstream REST query filters by) can
  // legitimately hold a combined circle's raw value ("Madhya Pradesh &
  // Chhattisgarh") rather than a plain state name - `stateOptions` only ever
  // lists plain names, so showing `state` directly in the input would show
  // that whole raw string instead of a clean, selectable-looking name. This
  // finds whichever plain option actually resolves (via `stateSourceMap`) to
  // the current `state` value, purely for what the input displays.
  const displayState =
    stateOptions.find((opt) => stateSourceMap?.get(normalizeName(opt)) === state) ?? state;

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
          value={displayState}
          onChange={(_e, value) => {
            // Resolve the plain name picked from the list back to the
            // actual raw `Site.state` (circle) value before it goes
            // anywhere - see `stateSourceMap`'s own doc comment above for
            // why passing the plain name straight through silently breaks
            // every downstream query for a combined circle.
            const resolved = value ? stateSourceMap?.get(normalizeName(value)) ?? value : null;
            onChangeState(resolved);
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
