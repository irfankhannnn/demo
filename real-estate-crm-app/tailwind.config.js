/**
 * Tailwind config.
 *
 * The theme was previously `extend: {}` — entirely stock Tailwind with no
 * design tokens at all, while a real token set sat unused in
 * marketing-and-sales/realestateflow/design-tokens.json and the brand blue was
 * copy-pasted as the literal #2563EB in 59 places across src/.
 *
 * Colours below mirror that token file. Keep the two in sync; it is the
 * lawyer-of-record for the brand and is also used by the marketing site.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary action colour. `brand` is the blue the product actually uses
        // for buttons and links; `ink` is the near-black the token file calls
        // "primary", used for headings and dark surfaces.
        brand: {
          DEFAULT: '#2563EB',
          light: '#3B82F6',
          lighter: '#60A5FA',
        },
        ink: {
          DEFAULT: '#0F172A',
          alt: '#1E293B',
        },
        accent: {
          DEFAULT: '#22C55E',
          light: '#4ADE80',
          lighter: '#86EFAC',
        },
        warn: {
          DEFAULT: '#EAB308',
          light: '#FACC15',
        },
        danger: {
          DEFAULT: '#EF4444',
          light: '#F87171',
        },
      },
      fontFamily: {
        // Body face. Headings use Poppins in the brand system, but the app
        // ships no webfonts today, so both fall back to the system stack
        // rather than pulling a render-blocking remote font into the WebView.
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      spacing: {
        // Minimum touch targets: 44px is the Apple HIG floor, 48px Material's.
        touch: '44px',
        'touch-lg': '48px',
      },
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
  plugins: [],
}
