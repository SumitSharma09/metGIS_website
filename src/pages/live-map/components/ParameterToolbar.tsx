import Paper from '@mui/material/Paper';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import ThermostatRoundedIcon from '@mui/icons-material/ThermostatRounded';
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import WbCloudyRoundedIcon from '@mui/icons-material/WbCloudyRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import CloudRoundedIcon from '@mui/icons-material/CloudRounded';
import AirRoundedIcon from '@mui/icons-material/AirRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import AcUnitRoundedIcon from '@mui/icons-material/AcUnitRounded';
import TerrainRoundedIcon from '@mui/icons-material/TerrainRounded';
import type { MapLayer } from '../mapLayers';

const LAYER_ICON: Record<MapLayer, JSX.Element> = {
  temperature: <ThermostatRoundedIcon fontSize="small" />,
  rainfall: <WaterDropRoundedIcon fontSize="small" />,
  cloud: <WbCloudyRoundedIcon fontSize="small" />,
  visibility: <VisibilityRoundedIcon fontSize="small" />,
  fog: <CloudRoundedIcon fontSize="small" />,
  wind: <AirRoundedIcon fontSize="small" />,
  lightning: <BoltRoundedIcon fontSize="small" />,
  snowfall: <AcUnitRoundedIcon fontSize="small" />,
  avalanche: <TerrainRoundedIcon fontSize="small" />,
};

const LAYER_SHORT_LABEL: Record<MapLayer, string> = {
  temperature: 'Temp',
  rainfall: 'Rainfall',
  cloud: 'Cloud',
  visibility: 'Visibility',
  fog: 'Fog',
  wind: 'Wind',
  lightning: 'Lightning',
  snowfall: 'Snowfall',
  avalanche: 'Avalanche',
};

// Live Map carries the everyday weather parameters; Fog, Lightning and
// Avalanche moved back to the Hazards page's own single Hazard Map (see
// HazardsPage.tsx/HazardMap.tsx), alongside Flood and Cyclone, so every
// hazard lives together in one place instead of being split across two
// pages. Snowfall stays here since it's an ordinary weather reading, not a
// hazard advisory.
const PARAMETER_ORDER: MapLayer[] = [
  'temperature',
  'rainfall',
  'cloud',
  'visibility',
  'snowfall',
];

interface ParameterToolbarProps {
  layer: MapLayer;
  onChangeLayer: (layer: MapLayer) => void;
  showWind: boolean;
  onToggleWind: (show: boolean) => void;
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

export function ParameterToolbar({ layer, onChangeLayer, showWind, onToggleWind }: ParameterToolbarProps) {
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
        onChange={(_e, value: MapLayer | null) => value && onChangeLayer(value)}
      >
        {PARAMETER_ORDER.map((value) => (
          <ToggleButton key={value} value={value} sx={BUTTON_SX}>
            {LAYER_ICON[value]}
            <Typography variant="caption" sx={{ fontSize: '0.65rem', lineHeight: 1 }}>
              {LAYER_SHORT_LABEL[value]}
            </Typography>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />

      <ToggleButton
        value="wind"
        size="small"
        selected={showWind}
        onChange={() => onToggleWind(!showWind)}
        sx={BUTTON_SX}
      >
        {LAYER_ICON.wind}
        <Typography variant="caption" sx={{ fontSize: '0.65rem', lineHeight: 1 }}>
          Wind
        </Typography>
      </ToggleButton>
    </Paper>
  );
}
