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
  /** Whether the "Indus" switch itself is shown at all - added 2026-09-30
   *  per explicit request ("Indus show after some click state or choose
   *  state then indus section show other default live-map hide the indus
   *  section"): LiveMapPage passes `Boolean(state)`, so the switch is
   *  missing entirely on the plain nationwide map and appears once a state
   *  is picked. Previously the switch was always visible and simply
   *  defaulted off, which still let it be flipped on nationwide (and, per
   *  LiveMapPage's own doc comment on `showTowers`, trigger a full-tower
   *  nationwide weather fetch) - hiding it removes that path rather than
   *  just discouraging it. Same pattern as `showInfoButton` below. */
  showTowersToggle: boolean;
  /** Opens the network-wide "Weather details" panel (see LiveMapPage /
   *  NetworkWeatherPanel) - matching the reference product, where this same
   *  (i) button is what shows live tower/weather info and jumps to Alerts
   *  and Reports, rather than a static help blurb. */
  onOpenInfo: () => void;
  /** Whether the (i) button itself is shown at all - added 2026-09-24 per
   *  explicit request ("if someone not click and not select the state in a
   *  live-map they hide the info button ... if someone select state and
   *  click ... then unhide"), then corrected the same day per a follow-up
   *  ("not in state select and without state. only applicable this button
   *  district") - a bare state selection must NOT unhide it. LiveMapPage
   *  passes `Boolean(district)`: the button stays hidden on the plain
   *  nationwide map AND while only a state is picked, appearing only once a
   *  specific DISTRICT has been selected (map click, the district search
   *  dropdown, or a tower click - all of which set `district`). */
  showInfoButton: boolean;
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
  showTowersToggle,
  onOpenInfo,
  showInfoButton,
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

      {showTowersToggle && (
        <>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />

          {/* Labeled "Indus" on screen (renamed from "Towers" per explicit
              request) - internal prop/state names (showTowers/onToggleTowers)
              are left unchanged, same as this project's earlier "Tower Risk
              Reports" -> "Districts Risk Reports" rename, which only touched
              user-facing text and left internal names alone. Hidden entirely
              (not just off) on the nationwide map - see `showTowersToggle`'s
              own doc comment above. */}
          <ToggleButton
            value="towers"
            size="small"
            selected={showTowers}
            onChange={() => onToggleTowers(!showTowers)}
            sx={BUTTON_SX}
          >
            <CellTowerRoundedIcon fontSize="small" /> Indus
          </ToggleButton>
        </>
      )}

      {showInfoButton && (
        <IconButton size="small" onClick={onOpenInfo}>
          <InfoRoundedIcon fontSize="small" />
        </IconButton>
      )}
      <IconButton size="small" onClick={toggleFullscreen}>
        {isFullscreen ? <FullscreenExitRoundedIcon fontSize="small" /> : <FullscreenRoundedIcon fontSize="small" />}
      </IconButton>
    </Paper>
  );
}
