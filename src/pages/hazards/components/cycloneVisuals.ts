import type { CycloneClassification } from '../hazardData';

// Ordered least -> most severe, matching hazardData.ts's CYCLONE_BANDS.
// Shared by CycloneTrackLayer, CycloneLegend and CycloneSummary so all three
// agree on category color/order without each redefining it.
export const CLASSIFICATION_ORDER: CycloneClassification[] = [
  'Low Pressure Area',
  'Depression',
  'Deep Depression',
  'Cyclonic Storm',
  'Severe Cyclonic Storm',
  'Very Severe Cyclonic Storm',
  'Super Cyclonic Storm',
];

export const CLASSIFICATION_COLOR: Record<CycloneClassification, string> = {
  'Low Pressure Area': '#94a3b8',
  Depression: '#38bdf8',
  'Deep Depression': '#0ea5e9',
  'Cyclonic Storm': '#eab308',
  'Severe Cyclonic Storm': '#f97316',
  'Very Severe Cyclonic Storm': '#dc2626',
  'Super Cyclonic Storm': '#7c3aed',
};

/** 16-point compass bearing from one track point to the next - used to give
 *  the storm's recent motion in plain words (e.g. "north-northwest") instead
 *  of just plotting the line and leaving the reader to work it out. */
export function compassBearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): string {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLon = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const points = [
    'north', 'north-northeast', 'northeast', 'east-northeast',
    'east', 'east-southeast', 'southeast', 'south-southeast',
    'south', 'south-southwest', 'southwest', 'west-southwest',
    'west', 'west-northwest', 'northwest', 'north-northwest',
  ];
  return points[Math.round(bearing / 22.5) % 16];
}
