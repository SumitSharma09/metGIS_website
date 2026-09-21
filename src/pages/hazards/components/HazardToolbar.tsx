import Paper from '@mui/material/Paper';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import CloudRoundedIcon from '@mui/icons-material/CloudRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import TerrainRoundedIcon from '@mui/icons-material/TerrainRounded';
import StormRoundedIcon from '@mui/icons-material/StormRounded';

export type HazardLayer = 'lightning' | 'flood' | 'avalanche' | 'fog' | 'cyclone';

const HAZARD_ICON: Record<HazardLayer, JSX.Element> = {
  lightning: <BoltRoundedIcon fontSize="small" />,
  flood: <WaterDropRoundedIcon fontSize="small" />,
  avalanche: <TerrainRoundedIcon fontSize="small" />,
  fog: <CloudRoundedIcon fontSize="small" />,
  cyclone: <StormRoundedIcon fontSize="small" />,
};

const HAZARD_LABEL: Record<HazardLayer, string> = {
  lightning: 'Lightning',
  flood: 'Flood',
  avalanche: 'Avalanche',
  fog: 'Fog',
  cyclone: 'Cyclone',
};

const HAZARD_ORDER: HazardLayer[] = ['lightning', 'flood', 'avalanche', 'fog', 'cyclone'];

interface HazardToolbarProps {
  layer: HazardLayer;
  onChangeLayer: (layer: HazardLayer) => void;
}

const BUTTON_SX = {
  flexDirection: 'column' as const,
  gap: 0.25,
  px: 1.25,
  py: 0.75,
  minWidth: 64,
  lineHeight: 1,
  textTransform: 'none' as const,
};

/**
 * Single-map parameter toggle for every hazard the app tracks - the exact
 * same pattern the Live Map's own `ParameterToolbar` uses for weather
 * parameters, just scoped to hazards. Fog/Lightning/Avalanche moved back
 * here off the Live Map so every hazard (plus Flood and Cyclone, which were
 * already hazard-only) lives on one map in one place, matching how the Live
 * Map itself is a single map with a toggle row rather than one map per
 * parameter.
 */
export function HazardToolbar({ layer, onChangeLayer }: HazardToolbarProps) {
  return (
    <Paper
      elevation={4}
      sx={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 1000,
        p: 0.75,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 0.75,
        maxWidth: 'calc(100% - 24px)',
        overflowX: 'auto',
        backgroundColor: 'background.paper',
        opacity: 0.97,
      }}
    >
      <ToggleButtonGroup
        size="small"
        exclusive
        value={layer}
        onChange={(_e, value: HazardLayer | null) => value && onChangeLayer(value)}
      >
        {HAZARD_ORDER.map((value) => (
          <ToggleButton key={value} value={value} sx={BUTTON_SX}>
            {HAZARD_ICON[value]}
            <Typography variant="caption" sx={{ fontSize: '0.65rem', lineHeight: 1 }}>
              {HAZARD_LABEL[value]}
            </Typography>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Paper>
  );
}
