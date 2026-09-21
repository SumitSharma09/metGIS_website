import WbSunnyRoundedIcon from '@mui/icons-material/WbSunnyRounded';
import CloudRoundedIcon from '@mui/icons-material/CloudRounded';
import FilterDramaRoundedIcon from '@mui/icons-material/FilterDramaRounded';
import ThunderstormRoundedIcon from '@mui/icons-material/ThunderstormRounded';
import GrainRoundedIcon from '@mui/icons-material/GrainRounded';
import AirRoundedIcon from '@mui/icons-material/AirRounded';
import DehazeRoundedIcon from '@mui/icons-material/DehazeRounded';
import type { ComponentType } from 'react';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import type { WeatherCondition } from '@/features/weather/types';

export const CONDITION_ICON: Record<WeatherCondition, ComponentType<SvgIconProps>> = {
  clear: WbSunnyRoundedIcon,
  'partly-cloudy': FilterDramaRoundedIcon,
  cloudy: CloudRoundedIcon,
  rain: GrainRoundedIcon,
  thunderstorm: ThunderstormRoundedIcon,
  fog: DehazeRoundedIcon,
  windy: AirRoundedIcon,
};

export const CONDITION_COLOR: Record<WeatherCondition, string> = {
  clear: '#d97706',
  'partly-cloudy': '#64748b',
  cloudy: '#64748b',
  rain: '#0284c7',
  thunderstorm: '#7c3aed',
  fog: '#94a3b8',
  windy: '#0ea5a4',
};

export const CONDITION_LABEL: Record<WeatherCondition, string> = {
  clear: 'Clear',
  'partly-cloudy': 'Partly Cloudy',
  cloudy: 'Cloudy',
  rain: 'Rain',
  thunderstorm: 'Thunderstorm',
  fog: 'Fog',
  windy: 'Windy',
};

export function WeatherIcon({ condition, sx }: { condition: WeatherCondition; sx?: object }) {
  const Icon = CONDITION_ICON[condition];
  return <Icon sx={{ color: CONDITION_COLOR[condition], ...sx }} />;
}
