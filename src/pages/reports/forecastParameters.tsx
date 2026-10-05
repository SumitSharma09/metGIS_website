import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import ThermostatRoundedIcon from '@mui/icons-material/ThermostatRounded';
import AirRoundedIcon from '@mui/icons-material/AirRounded';
import OpacityRoundedIcon from '@mui/icons-material/OpacityRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import FlashOnRoundedIcon from '@mui/icons-material/FlashOnRounded';
import WavesRoundedIcon from '@mui/icons-material/WavesRounded';
import BlurOnRoundedIcon from '@mui/icons-material/BlurOnRounded';
import AcUnitRoundedIcon from '@mui/icons-material/AcUnitRounded';
import TerrainRoundedIcon from '@mui/icons-material/TerrainRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {
  getParameterRisk,
  getVisibilityRisk,
  getSnowfallRisk,
  getAvalancheRisk,
  RISK_COLOR,
  REPORT_RISK_LABEL,
  type RiskLevel,
} from '@/utils/severity';
import { LAYER_LEGEND } from '@/pages/live-map/mapLayers';
import { getFloodRisk } from '@/pages/hazards/hazardData';
import type { Site } from '@/features/sites/types';
import type { CurrentObservation } from '@/features/weather/types';

/**
 * Shared per-parameter config for the Short-Range/Long-Range Forecast
 * table (component) and its PDF export (exportUtils.ts). Kept in its own
 * module - rather than defined inside the component file and imported by
 * exportUtils.ts, or vice versa - because the component itself calls the
 * PDF export function, and the export function needs this same band/label
 * config: either direction of a direct import between those two files
 * would be circular. (.tsx, not .ts, because the icon field below is JSX.)
 */

export interface Band {
  label: string;
  bg: string;
  text: string;
  rangeLabel: string;
  /** The RiskLevel this band represents, when it is one of the shared four
   *  (warning/alert/watch/none) - set by riskBand() below and used to
   *  reverse-lookup a band from a computed RiskLevel for hazard parameters.
   *  Rainfall's own mm-based bands (Extreme/High/Moderate/Low/Other) don't
   *  map one-to-one onto the four-level scale, so they leave this unset. */
  level?: RiskLevel;
}

/** A single pre-formatted table cell, computed once (in the component) and
 *  reused as-is by both the on-screen table and the PDF export, so the two
 *  can never disagree about a value or its color. */
export interface ForecastCell {
  band: Band;
  display: string;
}

export const NO_DATA_BAND: Band = { label: 'No data', bg: '#e5e7eb', text: '#374151', rangeLabel: '' };
export const NO_DATA_CELL: ForecastCell = { band: NO_DATA_BAND, display: 'N/A' };

/** Every RiskLevel-classified parameter (temperature/wind/humidity/
 *  visibility/lightning/flood/fog/snowfall/avalanche) reuses the app's own
 *  shared 4-band warning/alert/watch/none scale (already documented and
 *  used by the Live Map, Alerts, and Tower Risk Reports), in the "Extreme/
 *  High/Moderate/Normal" report wording - rather than inventing a fresh,
 *  undocumented threshold table for each one. */
function riskBand(level: RiskLevel, rangeLabel: string): Band {
  return { level, label: REPORT_RISK_LABEL[level], bg: RISK_COLOR[level], text: '#fff', rangeLabel };
}

// Exact bands from the scope document's own "Rainfall Forecast - 7 Days"
// sample legend (mm-based, not this app's shared 4-band scale) - kept
// local to rainfall only, the same way RiskIntensityDashboard keeps its
// own column wording local rather than folding it into the shared scale.
const RAINFALL_BANDS: (Band & { min: number })[] = [
  { min: 115.6, label: 'Extreme', bg: '#dc2626', text: '#fff', rangeLabel: '> 115.6 mm' },
  { min: 64.5, label: 'High', bg: '#f97316', text: '#fff', rangeLabel: '64.5 - 115.5 mm' },
  { min: 15.6, label: 'Moderate', bg: '#eab308', text: '#1f2937', rangeLabel: '15.6 - 64.4 mm' },
  { min: 2.5, label: 'Low', bg: '#86efac', text: '#14532d', rangeLabel: '2.5 - 15.5 mm' },
  { min: -Infinity, label: 'Other', bg: '#e5e7eb', text: '#374151', rangeLabel: '< 2.5 mm' },
];

function rainfallBand(mm: number): Band {
  return RAINFALL_BANDS.find((b) => mm >= b.min) ?? RAINFALL_BANDS[RAINFALL_BANDS.length - 1];
}

// severity.ts's humidity bands (95/90/80) have no LAYER_LEGEND entry of
// their own (that file only documents the layers the Live Map's parameter
// toggle actually renders) - spelled out here instead of inventing new
// thresholds.
const HUMIDITY_LEGEND: Record<RiskLevel, string> = {
  warning: '≥ 95%',
  alert: '90 - 94.9%',
  watch: '80 - 89.9%',
  none: '< 80%',
};

// Snowfall/avalanche have no single-reading numeric threshold (they're
// elevation + temperature/wind multi-factor - see severity.ts's own
// getSnowfallRisk/getAvalancheRisk), so their legend is a plain qualitative
// 4-level scale with no range label, same fallback mapLayers.ts documents
// for these two layers on the Live Map.
const QUALITATIVE_LEGEND: Band[] = (['warning', 'alert', 'watch', 'none'] as RiskLevel[]).map((l) => riskBand(l, ''));

export type ForecastParameterKey =
  | 'rainfall'
  | 'temperature'
  | 'windSpeed'
  | 'humidity'
  | 'visibility'
  | 'lightning'
  | 'flood'
  | 'fog'
  | 'snowfall'
  | 'avalanche'
  | 'cyclone';

interface BaseParameterConfig {
  key: ForecastParameterKey;
  label: string;
  icon: JSX.Element;
  legend: Band[];
  /** One-line disclaimer shown under a parameter's legend row, for
   *  parameters whose reading needs context (e.g. Flood having no separate
   *  hydrological model, or Snowfall/Avalanche being multi-factor). */
  note?: string;
}

/** A parameter with a genuine continuous reading (°C, mm, km/h, %, km,
 *  strikes/hr) - averaged across a district's sites, then banded. */
export interface MeasurementParameterConfig extends BaseParameterConfig {
  kind: 'measurement';
  unit: string;
  getValue: (obs: CurrentObservation) => number;
  getBand: (value: number) => Band;
}

/** A parameter that is only meaningful as a risk classification (Flood,
 *  Fog, Snowfall, Avalanche) - classified per site/day, then the district's
 *  cell shows the WORST level across its sites (matching how the Live Map
 *  and Today's Risk Intensity dashboard already aggregate hazards), not an
 *  averaged number. */
export interface HazardParameterConfig extends BaseParameterConfig {
  kind: 'hazard';
  classify: (obs: CurrentObservation, site: Site) => RiskLevel;
}

/** Cyclone isn't a per-district baseline reading at all - it's one named,
 *  tracked storm system (see hazardData.ts's getActiveCyclone), so it gets
 *  its own track-timeline + district-warnings panel instead of the
 *  per-district/per-day grid the other parameters share. Recognized here
 *  (rather than bolted on separately) so it still shows up automatically
 *  as a tab and as a PDF page alongside every other parameter. */
export interface CycloneParameterConfig extends BaseParameterConfig {
  kind: 'cyclone';
}

export type ForecastParameterConfig = MeasurementParameterConfig | HazardParameterConfig | CycloneParameterConfig;

export const FORECAST_PARAMETERS: ForecastParameterConfig[] = [
  {
    key: 'rainfall',
    label: 'Rainfall',
    kind: 'measurement',
    unit: 'mm',
    icon: <WaterDropRoundedIcon fontSize="small" />,
    getValue: (o) => o.rainfallLastHour,
    getBand: rainfallBand,
    legend: RAINFALL_BANDS,
    note: 'District-level figure from the 7-day forecast, shared by every tower in the district (not an hourly reading).',
  },
  {
    key: 'temperature',
    label: 'Temperature',
    kind: 'measurement',
    unit: '°C',
    icon: <ThermostatRoundedIcon fontSize="small" />,
    getValue: (o) => o.temperature,
    getBand: (v) => riskBand(getParameterRisk('temperature', v), ''),
    legend: (LAYER_LEGEND.temperature ?? []).map((b) => riskBand(b.level, b.rangeLabel)),
    note: 'District-level daily max from the 7-day forecast, shared by every tower in the district (not an hourly reading).',
  },
  {
    key: 'windSpeed',
    label: 'Wind Speed',
    kind: 'measurement',
    unit: 'km/h',
    icon: <AirRoundedIcon fontSize="small" />,
    getValue: (o) => o.windSpeed,
    getBand: (v) => riskBand(getParameterRisk('windSpeed', v), ''),
    legend: (LAYER_LEGEND.wind ?? []).map((b) => riskBand(b.level, b.rangeLabel)),
    note: 'District-level daily max from the 7-day forecast, shared by every tower in the district (not an hourly reading).',
  },
  {
    key: 'humidity',
    label: 'Humidity',
    kind: 'measurement',
    unit: '%',
    icon: <OpacityRoundedIcon fontSize="small" />,
    getValue: (o) => o.humidity,
    getBand: (v) => riskBand(getParameterRisk('humidity', v), ''),
    legend: (['warning', 'alert', 'watch', 'none'] as RiskLevel[]).map((l) => riskBand(l, HUMIDITY_LEGEND[l])),
  },
  {
    key: 'visibility',
    label: 'Visibility',
    kind: 'measurement',
    unit: 'km',
    icon: <VisibilityRoundedIcon fontSize="small" />,
    getValue: (o) => o.visibilityKm,
    getBand: (v) => riskBand(getVisibilityRisk(v), ''),
    legend: (LAYER_LEGEND.visibility ?? []).map((b) => riskBand(b.level, b.rangeLabel)),
  },
  {
    key: 'lightning',
    label: 'Lightning',
    kind: 'measurement',
    unit: '/hr',
    icon: <FlashOnRoundedIcon fontSize="small" />,
    getValue: (o) => o.lightningStrikesLastHour,
    getBand: (v) => riskBand(getParameterRisk('lightning', v), ''),
    legend: (LAYER_LEGEND.lightning ?? []).map((b) => riskBand(b.level, b.rangeLabel)),
  },
  {
    key: 'flood',
    label: 'Flood',
    kind: 'hazard',
    icon: <WavesRoundedIcon fontSize="small" />,
    classify: (obs, site) => getFloodRisk(site, obs),
    legend: (LAYER_LEGEND.rainfall ?? []).map((b) => riskBand(b.level, b.rangeLabel)),
    note: 'Derived from rainfall - no separate hydrological model behind this yet. In the Short/Long-Range table this reads the district-level 7-day forecast rainfall, not an hourly reading.',
  },
  {
    key: 'fog',
    label: 'Fog',
    kind: 'hazard',
    icon: <BlurOnRoundedIcon fontSize="small" />,
    classify: (obs) => (obs.condition === 'fog' ? getVisibilityRisk(obs.visibilityKm) : 'none'),
    legend: (LAYER_LEGEND.fog ?? []).map((b) => riskBand(b.level, b.rangeLabel)),
    note: 'No numeric visibility figure exists in the 7-day forecast feed - in the Short/Long-Range table this is derived from the forecast’s own day description text (fog/mist/haze), not a measurement.',
  },
  {
    key: 'snowfall',
    label: 'Snowfall',
    kind: 'hazard',
    icon: <AcUnitRoundedIcon fontSize="small" />,
    classify: (obs, site) => getSnowfallRisk(site.elevationMeters, obs.temperature),
    legend: QUALITATIVE_LEGEND,
    note: 'Elevation-dependent, using the district-level 7-day forecast temperature (not a single numeric threshold or an hourly reading).',
  },
  {
    key: 'avalanche',
    label: 'Avalanche',
    kind: 'hazard',
    icon: <TerrainRoundedIcon fontSize="small" />,
    classify: (obs, site) => getAvalancheRisk(site.elevationMeters, obs.temperature, obs.windSpeed),
    legend: QUALITATIVE_LEGEND,
    note: 'Elevation-dependent, using the district-level 7-day forecast temperature and wind (not a single numeric threshold or an hourly reading).',
  },
  {
    key: 'cyclone',
    label: 'Cyclone',
    kind: 'cyclone',
    icon: <WarningAmberRoundedIcon fontSize="small" />,
    legend: [],
    note: 'One named, tracked storm system - not every district has its own reading, unlike the parameters above.',
  },
];
