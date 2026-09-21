import { useState, type RefObject } from 'react';
import Paper from '@mui/material/Paper';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import SatelliteAltRoundedIcon from '@mui/icons-material/SatelliteAltRounded';
import CellTowerRoundedIcon from '@mui/icons-material/CellTowerRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import FullscreenExitRoundedIcon from '@mui/icons-material/FullscreenExitRounded';
import type { Basemap } from '../LiveMapPage';

interface MapViewControlsProps {
  basemap: Basemap;
  onChangeBasemap: (basemap: Basemap) => void;
  showTowers: boolean;
  onToggleTowers: (show: boolean) => void;
  /** Opens the network-wide "Weather details" panel (see LiveMapPage /
   *  NetworkWeatherPanel) - matching the reference product, where this same
   *  (i) button is what shows live tower/weather info and jumps to Alerts
   *  and Reports, rather than a static help blurb. */
  onOpenInfo: () => void;
  fullscreenTargetRef: RefObject<HTMLElement>;
  right?: number;
}

const BUTTON_SX = {
  px: 1.25,
  gap: 0.5,
  textTransform: 'none' as const,
};

export function MapViewControls({
  basemap,
  onChangeBasemap,
  showTowers,
  onToggleTowers,
  onOpenInfo,
  fullscreenTargetRef,
  right = 12,
}: MapViewControlsProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    const el = fullscreenTargetRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <Paper
      elevation={4}
      sx={{
        position: 'absolute',
        top: 12,
        right,
        zIndex: 1000,
        p: 0.5,
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        backgroundColor: 'background.paper',
        opacity: 0.97,
        transition: 'right 0.2s ease',
      }}
    >
      <ToggleButtonGroup
        size="small"
        exclusive
        value={basemap}
        onChange={(_e, value: Basemap | null) => value && onChangeBasemap(value)}
      >
        <ToggleButton value="street" sx={BUTTON_SX}>
          <MapRoundedIcon fontSize="small" /> Street
        </ToggleButton>
        <ToggleButton value="satellite" sx={BUTTON_SX}>
          <SatelliteAltRoundedIcon fontSize="small" /> Satellite
        </ToggleButton>
      </ToggleButtonGroup>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />

      <ToggleButton
        value="towers"
        size="small"
        selected={showTowers}
        onChange={() => onToggleTowers(!showTowers)}
        sx={BUTTON_SX}
      >
        <CellTowerRoundedIcon fontSize="small" /> Towers
      </ToggleButton>

      <IconButton size="small" onClick={onOpenInfo}>
        <InfoRoundedIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" onClick={toggleFullscreen}>
        {isFullscreen ? <FullscreenExitRoundedIcon fontSize="small" /> : <FullscreenRoundedIcon fontSize="small" />}
      </IconButton>
    </Paper>
  );
}
