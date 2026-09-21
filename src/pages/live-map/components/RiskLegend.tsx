import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import { RISK_LEVELS, RISK_COLOR, MAP_RISK_LABEL, NO_DATA_COLOR } from '@/utils/severity';
import { LAYER_COLORS, LAYER_LEGEND, MAP_LAYERS, layerGradientCss, type MapLayer } from '../mapLayers';
import { WIND_GRADIENT_CSS } from '../windField';

interface RiskLegendProps {
  /** When set, the legend shows this layer's own color family and (where
   *  defined) numeric threshold ranges, instead of the generic scale. */
  layer?: MapLayer;
  /** Overrides the title derived from `layer` - e.g. the Hazards page's
   *  Flood map reuses rainfall's exact thresholds/colors (flood risk *is*
   *  rainfall risk - see hazardData.ts's getFloodRisk) but wants to be
   *  labeled "FLOOD RISK", not "RAINFALL". */
  title?: string;
  /** Adds a small "Calm -> Gust" wind-speed gradient swatch below the main
   *  scale, matching the animated wind-flow overlay's own color coding
   *  (see WindFlowLayer.tsx) - only meaningful while that overlay is on. */
  showWindGradient?: boolean;
  /** Distance from the map's right edge, in px - shifted further left while
   *  the Weather details side panel is open so the two never overlap (see
   *  LiveMapPage.tsx). Defaults to sitting just under the view-controls row. */
  right?: number;
}

export function RiskLegend({ layer, title, showWindGradient, right = 12 }: RiskLegendProps) {
  const colors = layer ? LAYER_COLORS[layer] : RISK_COLOR;
  const bands = layer ? LAYER_LEGEND[layer] : undefined;
  const legendTitle = title ?? (layer ? MAP_LAYERS.find((l) => l.value === layer)?.label : 'RISK LEVEL');
  const gradient = layerGradientCss(colors);

  return (
    <Paper
      elevation={4}
      sx={{
        position: 'absolute',
        top: 68,
        right,
        zIndex: 900,
        px: 1.5,
        py: 1.25,
        minWidth: 170,
        backgroundColor: 'background.paper',
        opacity: 0.96,
        transition: 'right 0.2s ease',
      }}
    >
      <Typography
        variant="caption"
        fontWeight={700}
        color="text.secondary"
        sx={{ display: 'block', mb: 1, letterSpacing: 0.5, textTransform: 'uppercase' }}
      >
        {legendTitle}
      </Typography>
      <Stack direction="row" spacing={1.25} alignItems="stretch">
        <Box sx={{ width: 10, borderRadius: 0.5, background: gradient, flexShrink: 0 }} />
        <Stack justifyContent="space-between" sx={{ py: 0.1 }}>
          {RISK_LEVELS.map((level) => {
            const rangeLabel = bands?.find((b) => b.level === level)?.rangeLabel;
            return (
              <Stack key={level} spacing={0} sx={{ lineHeight: 1.1 }}>
                <Typography variant="caption" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                  {MAP_RISK_LABEL[level]}
                </Typography>
                {rangeLabel && (
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2, fontSize: '0.68rem' }}>
                    {rangeLabel}
                  </Typography>
                )}
              </Stack>
            );
          })}
        </Stack>
      </Stack>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
        <Box sx={{ width: 12, height: 12, borderRadius: 0.5, backgroundColor: NO_DATA_COLOR, flexShrink: 0 }} />
        <Typography variant="caption" color="text.secondary">
          No data
        </Typography>
      </Stack>

      {showWindGradient && (
        <>
          <Divider sx={{ my: 1 }} />
          <Typography
            variant="caption"
            fontWeight={700}
            color="text.secondary"
            sx={{ display: 'block', mb: 0.75, letterSpacing: 0.5 }}
          >
            WIND
          </Typography>
          <Stack direction="row" spacing={1} alignItems="stretch">
            <Box sx={{ width: 10, height: 64, borderRadius: 0.5, background: WIND_GRADIENT_CSS, flexShrink: 0 }} />
            <Stack justifyContent="space-between" sx={{ py: 0.25 }}>
              <Typography variant="caption" sx={{ lineHeight: 1 }}>
                Gust
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                Calm
              </Typography>
            </Stack>
          </Stack>
        </>
      )}
    </Paper>
  );
}
