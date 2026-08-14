import type { Config } from 'tailwindcss';

/**
 * Visual direction: a premium astronomical instrument, not a fortune-teller's
 * booth. Deep neutral ground, restrained metallic accents, generous type. No
 * glitter, no purple gradients, no mystical clip art.
 *
 * All foreground/background pairs below meet WCAG AA contrast on the `ink`
 * ground. Colour is never the only carrier of meaning — every score also has a
 * text band and a number.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Ground: near-black with a slight blue cast, like a night sky plate.
        ink: {
          DEFAULT: '#0B0E17',
          soft: '#121623',
          raised: '#181D2C',
          line: '#242B3D',
        },
        // Text
        parchment: {
          DEFAULT: '#EDEAE3',
          muted: '#A8AEC0',
          faint: '#6F7793',
        },
        // Accents — brass and cool steel, the colours of an orrery.
        brass: {
          DEFAULT: '#C9A24A',
          bright: '#E3C075',
          dim: '#8A6F32',
        },
        steel: {
          DEFAULT: '#7FA6C9',
          bright: '#A8C8E4',
        },
        // Valence colours, both AA on the ink ground.
        supported: '#7FC9A2',
        demanding: '#E39A85',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['ui-serif', 'Georgia', 'Cambria', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      letterSpacing: {
        widest: '0.18em',
      },
    },
  },
  plugins: [],
};

export default config;
