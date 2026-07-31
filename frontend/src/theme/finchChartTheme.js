/**
 * Finch chart & map theme.
 *
 * Charting libraries (recharts) and Leaflet need real hex strings, not CSS
 * custom properties. This module and `src/index.css` are the only two places
 * in `src/` allowed to hold raw hexes — everything else goes through Tailwind
 * utilities backed by the tokens.
 */

/** Categorical series order: orange → green → yellow → bark, then lighter repeats. */
export const CHART_SERIES = [
  '#E2721B', // orange-500
  '#35633A', // green-600
  '#F2B705', // yellow-500
  '#8A7A63', // bark-400
  '#F08A2E', // orange-400
  '#6B9A54', // green-400
  '#C23A22', // danger
  '#D6C6A8', // sand-300
];

export const CHART_GRID = '#E7DBC6'; // sand-200

export const CHART_TICK = {
  fontSize: 12,
  fill: '#6E5E48', // bark-500
  fontFamily: "'IBM Plex Mono', monospace",
};

export const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#FFF',
  border: '1px solid #E7DBC6',
  borderRadius: '8px',
  fontSize: '12.5px',
  fontFamily: "'Hanken Grotesk', sans-serif",
  boxShadow: '0 4px 12px rgba(46, 37, 25, 0.08)',
};

export const CHART_TOOLTIP_LABEL_STYLE = {
  color: '#2E2519', // bark-800
  fontWeight: 600,
  marginBottom: '2px',
};

export const CHART_AXIS_LINE = '#D6C6A8'; // sand-300

/** Pie/doughnut slice separator. */
export const CHART_PIE_STROKE = '#FFFFFF';

export const STATUS_HEX = {
  success: '#4A7C43',
  warning: '#F2B705',
  danger: '#C23A22',
  info: '#35633A',
  neutral: '#8A7A63',
};

export const MAP_HEX = {
  boundary: '#274A2B',     // green-700
  fieldFill: '#9BBE7E',    // green-300
  fieldStroke: '#35633A',  // green-600
  marker: '#E2721B',       // orange-500
  selected: '#F2B705',     // yellow-500
  water: '#35633A',        // green-600
  muted: '#BEA981',        // sand-400
  parcelFill: '#C7DBB2',   // green-200
  parcelStroke: '#274A2B', // green-700
  draw: '#E2721B',         // orange-500
  drawFill: '#FBD0A0',     // orange-200
  surface: '#FFFFFF',
  ink: '#2E2519',          // bark-800
};

/** Crop-family colours for map markers/fills. Strokes are one step darker. */
export const CROP_HEX = {
  navel: { fill: '#E2721B', stroke: '#C85A17' },
  valencia: { fill: '#F08A2E', stroke: '#E2721B' },
  lemon: { fill: '#F2B705', stroke: '#C99304' },
  grapefruit: { fill: '#F6A94E', stroke: '#F08A2E' },
  lime: { fill: '#4A7C43', stroke: '#35633A' },
  mandarin: { fill: '#C85A17', stroke: '#A8480F' },
  default: { fill: '#35633A', stroke: '#274A2B' },
};

export function cropColor(cropType) {
  if (!cropType) return CROP_HEX.default;
  const key = String(cropType).toLowerCase();
  const match = Object.keys(CROP_HEX).find((k) => k !== 'default' && key.includes(k));
  return match ? CROP_HEX[match] : CROP_HEX.default;
}

/* ------------------------------------------------------------------------- */

const RAMP_STOPS = [
  [246, 201, 71],  // yellow-400
  [242, 183, 5],   // yellow-500
  [226, 114, 27],  // orange-500
  [168, 72, 15],   // orange-700
  [53, 99, 58],    // green-600
  [28, 58, 33],    // green-800
  [46, 37, 25],    // bark-800
];

const toHex = (n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');

/**
 * An n-step sequential ramp (light Meyer yellow → Valencia orange → grove
 * green → bark) for distributions, heat scales and choropleths.
 */
export function sequential(n) {
  const steps = Math.max(1, Math.floor(n));
  if (steps === 1) return ['#E2721B'];

  const last = RAMP_STOPS.length - 1;
  return Array.from({ length: steps }, (_, i) => {
    const pos = (i / (steps - 1)) * last;
    const lo = Math.floor(pos);
    const hi = Math.min(last, lo + 1);
    const t = pos - lo;
    const [r1, g1, b1] = RAMP_STOPS[lo];
    const [r2, g2, b2] = RAMP_STOPS[hi];
    return `#${toHex(r1 + (r2 - r1) * t)}${toHex(g1 + (g2 - g1) * t)}${toHex(b1 + (b2 - b1) * t)}`.toUpperCase();
  });
}

/** Pick a categorical series colour by index, wrapping. */
export function seriesColor(index) {
  return CHART_SERIES[index % CHART_SERIES.length];
}
