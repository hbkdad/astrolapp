import {
  ZODIAC_SIGNS,
  formatZodiacPosition,
  type NatalChart,
  type BodyId,
} from '@astrolapp/astro-engine';

/**
 * Natal chart wheel.
 *
 * Geometry only — this component performs no astrology. It receives a computed
 * `NatalChart` and draws it. Keeping layout separate from calculation is why the
 * wheel can be changed freely without any risk to correctness.
 *
 * ORIENTATION follows the standard convention: the Ascendant sits at the left
 * (9 o'clock) and ecliptic longitude increases anticlockwise. So the screen
 * angle for a longitude is `180 + (longitude - ascendant)` degrees measured
 * anticlockwise from the 3 o'clock position. This places the Midheaven near the
 * top and the Imum Coeli near the bottom, as expected.
 *
 * ACCESSIBILITY: the drawing is `aria-hidden`, and the full contents are
 * published as a real table beneath it. A chart that can only be read visually
 * is not readable at all for some users, and colour is never load-bearing here.
 */

const SIZE = 520;
const CENTRE = SIZE / 2;
const OUTER_RADIUS = 250;
const SIGN_INNER_RADIUS = 214;
const HOUSE_RING_RADIUS = 176;
const PLANET_RADIUS = 150;
const ASPECT_RADIUS = 138;

const SIGN_ABBREVIATIONS = [
  'Ari',
  'Tau',
  'Gem',
  'Can',
  'Leo',
  'Vir',
  'Lib',
  'Sco',
  'Sag',
  'Cap',
  'Aqu',
  'Pis',
];

const BODY_ABBREVIATIONS: Record<BodyId, string> = {
  sun: 'Su',
  moon: 'Mo',
  mercury: 'Me',
  venus: 'Ve',
  mars: 'Ma',
  jupiter: 'Ju',
  saturn: 'Sa',
  uranus: 'Ur',
  neptune: 'Ne',
  pluto: 'Pl',
  northNode: 'NN',
  southNode: 'SN',
};

/** Colour by aspect nature. Reinforced by the aspect table, never load-bearing. */
const ASPECT_STROKE: Record<string, string> = {
  conjunction: '#C9A24A',
  trine: '#7FC9A2',
  sextile: '#7FA6C9',
  square: '#E39A85',
  opposition: '#E39A85',
};

interface Point {
  x: number;
  y: number;
}

function polar(longitude: number, ascendant: number, radius: number): Point {
  const screenAngle = ((180 + (longitude - ascendant)) * Math.PI) / 180;
  return {
    x: CENTRE + radius * Math.cos(screenAngle),
    y: CENTRE - radius * Math.sin(screenAngle),
  };
}

/**
 * Spread labels that would otherwise overlap.
 *
 * Planets within a few degrees of each other collide when drawn at their true
 * longitude. This nudges the DRAW position only; the reported degree in the
 * table is always the real one.
 */
function spreadLongitudes(longitudes: number[], minimumSeparation = 7): number[] {
  const order = longitudes
    .map((longitude, index) => ({ longitude, index }))
    .sort((left, right) => left.longitude - right.longitude);

  const adjusted = [...longitudes];
  for (let pass = 0; pass < 4; pass += 1) {
    for (let i = 1; i < order.length; i += 1) {
      const previous = order[i - 1];
      const current = order[i];
      if (previous === undefined || current === undefined) continue;

      const gap = adjusted[current.index]! - adjusted[previous.index]!;
      if (gap < minimumSeparation) {
        const shift = (minimumSeparation - gap) / 2;
        adjusted[previous.index] = adjusted[previous.index]! - shift;
        adjusted[current.index] = adjusted[current.index]! + shift;
      }
    }
  }
  return adjusted;
}

export function ChartWheel({
  chart,
  showHouses,
}: {
  chart: NatalChart;
  /** False when the birth time is unknown, in which case houses are meaningless. */
  showHouses: boolean;
}) {
  const ascendant = chart.angles.ascendant;
  const drawnLongitudes = spreadLongitudes(chart.placements.map((p) => p.longitude));

  return (
    // `min-w-0` is load-bearing: grid and flex items default to `min-width:auto`,
    // so the min-width on the table below would otherwise widen the whole column
    // past the viewport instead of scrolling within its own container.
    <div className="min-w-0">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto h-auto w-full max-w-[520px]"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx={CENTRE} cy={CENTRE} r={OUTER_RADIUS} fill="none" stroke="#242B3D" />
        <circle cx={CENTRE} cy={CENTRE} r={SIGN_INNER_RADIUS} fill="none" stroke="#242B3D" />
        <circle cx={CENTRE} cy={CENTRE} r={ASPECT_RADIUS} fill="none" stroke="#181D2C" />

        {/* Sign divisions and labels */}
        {ZODIAC_SIGNS.map((sign, index) => {
          const boundary = index * 30;
          const outer = polar(boundary, ascendant, OUTER_RADIUS);
          const inner = polar(boundary, ascendant, SIGN_INNER_RADIUS);
          const label = polar(boundary + 15, ascendant, (OUTER_RADIUS + SIGN_INNER_RADIUS) / 2);
          return (
            <g key={sign}>
              <line x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y} stroke="#242B3D" />
              <text
                x={label.x}
                y={label.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="13"
                fill="#A8AEC0"
                fontFamily="ui-sans-serif, system-ui"
              >
                {SIGN_ABBREVIATIONS[index]}
              </text>
            </g>
          );
        })}

        {/* House cusps */}
        {showHouses &&
          chart.cusps.map((cusp) => {
            const outer = polar(cusp.longitude, ascendant, SIGN_INNER_RADIUS);
            const inner = polar(cusp.longitude, ascendant, ASPECT_RADIUS);
            const numberAt = polar(cusp.longitude + 4, ascendant, HOUSE_RING_RADIUS);
            const isAngular = [1, 4, 7, 10].includes(cusp.house);
            return (
              <g key={cusp.house}>
                <line
                  x1={outer.x}
                  y1={outer.y}
                  x2={inner.x}
                  y2={inner.y}
                  stroke={isAngular ? '#8A6F32' : '#242B3D'}
                  strokeWidth={isAngular ? 1.5 : 1}
                />
                <text
                  x={numberAt.x}
                  y={numberAt.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="10"
                  fill="#6F7793"
                  fontFamily="ui-sans-serif, system-ui"
                >
                  {cusp.house}
                </text>
              </g>
            );
          })}

        {/* Aspect lines */}
        <g opacity={0.55}>
          {chart.aspects.map(({ from, to, aspect }, index) => {
            const fromPlacement = chart.placements.find((p) => p.body === from);
            const toPlacement = chart.placements.find((p) => p.body === to);
            if (fromPlacement === undefined || toPlacement === undefined) return null;

            const start = polar(fromPlacement.longitude, ascendant, ASPECT_RADIUS);
            const end = polar(toPlacement.longitude, ascendant, ASPECT_RADIUS);
            return (
              <line
                key={`${from}-${to}-${index}`}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={ASPECT_STROKE[aspect.type] ?? '#6F7793'}
                strokeWidth={0.5 + aspect.normalizedStrength * 1.2}
              />
            );
          })}
        </g>

        {/* Planets */}
        {chart.placements.map((placement, index) => {
          const drawAt = drawnLongitudes[index] ?? placement.longitude;
          const marker = polar(placement.longitude, ascendant, ASPECT_RADIUS);
          const glyph = polar(drawAt, ascendant, PLANET_RADIUS);
          return (
            <g key={placement.body}>
              <line
                x1={marker.x}
                y1={marker.y}
                x2={glyph.x}
                y2={glyph.y}
                stroke="#3A4358"
                strokeWidth={0.75}
              />
              <circle cx={glyph.x} cy={glyph.y} r={13} fill="#121623" stroke="#242B3D" />
              <text
                x={glyph.x}
                y={glyph.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="11"
                fill="#EDEAE3"
                fontFamily="ui-sans-serif, system-ui"
              >
                {BODY_ABBREVIATIONS[placement.body]}
              </text>
            </g>
          );
        })}

        {/* Angles */}
        {showHouses &&
          (
            [
              ['ASC', chart.angles.ascendant],
              ['MC', chart.angles.midheaven],
            ] as const
          ).map(([label, longitude]) => {
            const at = polar(longitude, ascendant, OUTER_RADIUS + 16);
            return (
              <text
                key={label}
                x={at.x}
                y={at.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="11"
                fill="#C9A24A"
                fontFamily="ui-sans-serif, system-ui"
              >
                {label}
              </text>
            );
          })}
      </svg>

      {/* The text equivalent. Not a fallback — the primary accessible reading. */}
      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-sm">
          <caption className="mb-3 text-left text-xs text-parchment-faint">
            Placements in this chart. This table contains the same information as the wheel above.
          </caption>
          <thead>
            <tr className="border-b border-ink-line text-left">
              <th scope="col" className="py-2 pr-4 font-medium text-parchment-muted">
                Body
              </th>
              <th scope="col" className="py-2 pr-4 font-medium text-parchment-muted">
                Position
              </th>
              {showHouses && (
                <th scope="col" className="py-2 pr-4 font-medium text-parchment-muted">
                  House
                </th>
              )}
              <th scope="col" className="py-2 font-medium text-parchment-muted">
                Motion
              </th>
            </tr>
          </thead>
          <tbody>
            {chart.placements.map((placement) => (
              <tr key={placement.body} className="border-b border-ink-line/60">
                <th
                  scope="row"
                  className="py-2 pr-4 text-left font-normal capitalize text-parchment"
                >
                  {placement.body.replace(/([A-Z])/g, ' $1')}
                </th>
                <td className="py-2 pr-4 font-mono text-parchment-muted">
                  {formatZodiacPosition(placement.position)}
                </td>
                {showHouses && (
                  <td className="py-2 pr-4 font-mono text-parchment-muted">{placement.house}</td>
                )}
                <td className="py-2 text-parchment-faint">
                  {placement.retrograde ? 'Retrograde' : 'Direct'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
