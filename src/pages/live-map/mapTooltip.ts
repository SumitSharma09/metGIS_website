/**
 * Shared builder for the Live Map's hover-tooltip HTML - used by
 * `DistrictLayer.tsx` (district polygon hover), `StateOutlinesLayer.tsx`
 * (state polygon hover, the default nationwide view) and
 * `ClusteredSiteMarkers.tsx` (individual tower marker hover), so all three
 * hover surfaces on the map share one professional-looking card design
 * instead of each hand-rolling its own `<strong>...</strong> &middot; ...`
 * string. Added 2026-09-22 per explicit request: "make a mouse over good
 * looking or a professional way please."
 *
 * Pair with `mapTooltip.css` (imported by each of the three files above) -
 * that stylesheet resets Leaflet's default tooltip chrome (white box,
 * padding, shadow, arrow tail) for `WEATHER_TOOLTIP_CLASSNAME` so this
 * card's own styling fully controls the look, and defines the `.wx-tt-*`
 * classes this file's HTML relies on.
 */

export interface WeatherTooltipRow {
  /** Omit for the tooltip's own currently-active-parameter reading (e.g. a
   *  bare "27.8°C" with no "Temperature" label) - removed 2026-09-24 per
   *  explicit request ("remove parameter name with data in the mouse over"),
   *  since which parameter that is is already shown by the selected button
   *  in the Parameter toolbar and by the map's own fill color. Every other
   *  row (Risk level, Direction, Gust, Monitored towers) still passes a
   *  label - there's no other way to tell those apart. When omitted, the
   *  row renders as a lone right-aligned value (see `.wx-tt__row--solo` in
   *  mapTooltip.css). */
  label?: string;
  /** Already formatted with its unit, e.g. "14.2 km/h" (via
   *  `formatWithUnit`) - this file only lays it out, it doesn't format
   *  numbers itself. */
  value: string;
  /** When set, rotates a small arrow glyph next to the value to point this
   *  many degrees (meteorological convention: the direction the wind is
   *  blowing FROM, 0/360 = north) - wind rows only; every other parameter
   *  omits this. */
  arrowDegrees?: number;
}

export interface WeatherTooltipOptions {
  title: string;
  subtitle?: string;
  /** Small note rendered under the subtitle in a muted style - already-safe
   *  HTML (callers build this themselves, e.g. a tehsil-scope or
   *  combined-circle note that includes its own inline styling), NOT
   *  escaped here. Omit when there's nothing to add. */
  note?: string;
  /** Left accent bar color - normally the same fill color the polygon/
   *  marker itself is shaded with, so the tooltip and the shape's own color
   *  visibly agree instead of looking unrelated. */
  accentColor: string;
  /** Already-formatted "As of <date>, <time>" text (e.g. via
   *  `formatDateTime` from `@/utils/formatters`) for the exact hour/instant
   *  the reading below is as-of - added 2026-09-23 per explicit request
   *  ("in live-map is hourly data mention the time okay"). Every reading
   *  this tooltip shows is hourly (one `hourly_weather` row per site per
   *  hour, see districtRisk.ts/mapLayers.ts's own doc comments), and which
   *  hour that is - "now," or wherever the Live Map's timeline scrubber is
   *  parked - is otherwise invisible in the tooltip itself. Callers pass
   *  the SAME shared instant (`useMapTimeline().at`) already used to fetch
   *  every observation this render shows, so it always matches the data,
   *  never a separately-computed "now." Omitted (no line shown) when not
   *  supplied. */
  asOf?: string;
  rows: WeatherTooltipRow[];
  /** Shown in place of the rows list when the caller explicitly wants a
   *  "nothing real to show" message (e.g. "No monitored towers yet") -
   *  never a fabricated reading. When both this and `rows` are empty, the
   *  body/divider are omitted entirely and only the header renders (the
   *  plain location-only tooltip for an unmonitored place). */
  emptyText?: string;
}

/** Leaflet tooltip content is raw HTML dropped straight into the DOM, so
 *  anything sourced from real data (a district/state name, a formatted
 *  reading) is escaped before being interpolated - `note` is the one
 *  exception, since callers already build it as trusted, pre-formed HTML. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** The `className` to pass to Leaflet's `bindTooltip(html, { className })` -
 *  see `mapTooltip.css` for what it resets/enables. */
export const WEATHER_TOOLTIP_CLASSNAME = 'wx-tt-container';

export function buildWeatherTooltipHtml(opts: WeatherTooltipOptions): string {
  const hasBody = opts.rows.length > 0 || !!opts.emptyText;

  const rowsHtml = opts.rows.length
    ? opts.rows
        .map((row) => {
          const arrow =
            row.arrowDegrees !== undefined
              ? `<span class="wx-tt__arrow" style="transform:rotate(${row.arrowDegrees}deg)">&#8593;</span>`
              : '';
          const rowClass = row.label ? 'wx-tt__row' : 'wx-tt__row wx-tt__row--solo';
          const labelHtml = row.label ? `<span class="wx-tt__row-label">${escapeHtml(row.label)}</span>` : '';
          return `<div class="${rowClass}">${labelHtml}<span class="wx-tt__row-value">${arrow}${escapeHtml(row.value)}</span></div>`;
        })
        .join('')
    : opts.emptyText
      ? `<div class="wx-tt__empty">${escapeHtml(opts.emptyText)}</div>`
      : '';

  return (
    `<div class="wx-tt" style="border-left-color:${opts.accentColor}">` +
    `<div class="wx-tt__header">` +
    `<div class="wx-tt__title">${escapeHtml(opts.title)}</div>` +
    (opts.subtitle ? `<div class="wx-tt__subtitle">${escapeHtml(opts.subtitle)}</div>` : '') +
    (opts.asOf ? `<div class="wx-tt__asof">${escapeHtml(opts.asOf)}</div>` : '') +
    (opts.note ? `<div class="wx-tt__note">${opts.note}</div>` : '') +
    `</div>` +
    (hasBody ? `<div class="wx-tt__divider"></div><div class="wx-tt__body">${rowsHtml}</div>` : '') +
    `</div>`
  );
}
