export const APP_NAME = import.meta.env.VITE_APP_NAME || 'MetGIS';

export const USE_MOCK_API = (import.meta.env.VITE_USE_MOCK_API ?? 'true') !== 'false';

export const MOCK_LATENCY_MS = Number(import.meta.env.VITE_MOCK_LATENCY_MS ?? 450);

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const AUTH_TOKEN_STORAGE_KEY = 'metgis.auth.token';
export const AUTH_USER_STORAGE_KEY = 'metgis.auth.user';
export const THEME_MODE_STORAGE_KEY = 'metgis.ui.themeMode';

export const DRAWER_WIDTH = 260;
export const DRAWER_WIDTH_COLLAPSED = 76;

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

export type WeatherParameter =
  | 'temperature'
  | 'rainfall'
  | 'windSpeed'
  | 'windDirection'
  | 'humidity'
  | 'pressure'
  | 'lightning';

export const WEATHER_PARAMETERS: { value: WeatherParameter; label: string; unit: string }[] = [
  { value: 'temperature', label: 'Temperature', unit: '°C' },
  { value: 'rainfall', label: 'Rainfall', unit: 'mm' },
  { value: 'windSpeed', label: 'Wind Speed', unit: 'km/h' },
  { value: 'windDirection', label: 'Wind Direction', unit: '°' },
  { value: 'humidity', label: 'Humidity', unit: '%' },
  { value: 'pressure', label: 'Pressure', unit: 'hPa' },
  { value: 'lightning', label: 'Lightning Strikes', unit: 'count' },
];

export type AlertSeverity = 'critical' | 'high' | 'moderate' | 'low' | 'info';

export const ALERT_SEVERITIES: AlertSeverity[] = ['critical', 'high', 'moderate', 'low', 'info'];

export type SiteStatus = 'active' | 'inactive' | 'maintenance';
