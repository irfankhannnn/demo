/**
 * Tailwind config — "Bazaar Signal" v3 tokens on a light paper ground.
 * Source of truth: marketing-and-sales/creative/realestateflow-launch/brand-kit.md
 *
 * Accent discipline: marigold is the primary action colour; gulal is reserved
 * for AI moments (match badge, "why this matches"); tulsi only for success/
 * verified. Never anchor one card with both marigold and gulal.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#1C1512', 2: '#251C16', 3: '#2E241D' },
        paper: { DEFAULT: '#FBF2E4', 2: '#F3E6D2', 3: '#EBDBC2' },
        marigold: { DEFAULT: '#FF7A1A', hover: '#E8620A', soft: '#FFE7D3', deep: '#B84A05' },
        gulal: { DEFAULT: '#FF3D7F', hover: '#E01F63', soft: '#FFE0EA', deep: '#B0104A' },
        tulsi: { DEFAULT: '#1FAA59', soft: '#DDF4E6', deep: '#15743D' },
        dust: { DEFAULT: '#C9BBA8', dim: '#948575' },
        line: '#E6D8C3',
        danger: '#EF4444',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Unbounded', 'Manrope', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '16px', pill: '999px' },
      boxShadow: {
        card: '0 1px 2px rgba(28,21,18,0.05), 0 8px 24px -12px rgba(28,21,18,0.18)',
        'card-hover': '0 2px 4px rgba(28,21,18,0.06), 0 18px 40px -16px rgba(28,21,18,0.28)',
        sheet: '0 -8px 32px -8px rgba(28,21,18,0.25)',
        pop: '0 12px 40px -8px rgba(28,21,18,0.35)',
      },
      spacing: { touch: '44px' },
      minHeight: { touch: '44px' },
      minWidth: { touch: '44px' },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        rise: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
        rise: 'rise 260ms ease-out both',
      },
    },
  },
  plugins: [],
};
