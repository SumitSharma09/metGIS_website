import Paper from '@mui/material/Paper';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import ThermostatRoundedIcon from '@mui/icons-material/ThermostatRounded';
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import OpacityRoundedIcon from '@mui/icons-material/OpacityRounded';
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
  // Distinct from rainfall's raindrop icon (OpacityRounded reads as
  // "moisture" rather than "falling rain") - added 2026-09-23.
  humidity: <OpacityRoundedIcon fontSize="small" />,
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
  humidity: 'Humidity',
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
//
// 'wind' was missing from this list entirely (fixed 2026-09-23, real bug -
// "if i click the wind ... that data show me on map but mouse over didn't
// show the parameter name with data"): a standalone "Wind" toggle used to
// sit at the end of this toolbar controlling only `showWind`, the animated
// wind-FLOW streamline overlay (WindFlowLayer) - it never called
// `onChangeLayer('wind')`, so the map's active PARAMETER (the thing that
// actually drives the choropleth coloring and every hover tooltip's
// reading row) could never become Wind through the UI, even though `layer`
// itself, `layerRisk`/`layerReading`/`layerUnitLabel` (mapLayers.ts),
// `buildDistrictRiskIndex`/`buildStateRiskIndex` (districtRisk.ts), and
// every hover-tooltip row builder (DistrictLayer/StateOutlinesLayer/
// ClusteredSiteMarkers) have supported 'wind' as a full parameter,
// including its own Direction/Gust tooltip rows, since earlier this
// session. Added here, in the same relative position MAP_LAYERS itself
// already lists it (right after visibility, before snowfall), so Wind is a
// normal selectable parameter alongside Temperature/Rainfall/Cloud/
// Visibility/Snowfall.
//
// Follow-up the same day ("please merge this windflow with wind
// button"): the separate flow-overlay toggle described above has been
// REMOVED from this toolbar entirely. There is now exactly one Wind
// control here, and selecting it is what turns the flow-arrows overlay on
// too - see LiveMapPage.tsx, which derives `showWind` straight from
// `layer === 'wind'` instead of tracking it as independent state. So
// clicking this button now does both things the user wants in one click:
// makes Wind the active choropleth/tooltip parameter AND shows the
// animated flow arrows; picking any other parameter turns the arrows back
// off automatically.
const PARAMETER_ORDER: MapLayer[] = [
  'temperature',
  'rainfall',
  'humidity',
  'cloud',
  'visibility',
  'wind',
  'snowfall',
];

interface ParameterToolbarProps {
  layer: MapLayer;
  onChangeLayer: (layer: MapLayer) => void;
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

export function ParameterToolbar({ layer, onChangeLayer }: ParameterToolbarProps) {
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
    </Paper>
  );
}
