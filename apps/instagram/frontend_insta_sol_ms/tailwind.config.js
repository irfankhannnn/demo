/**
 * Tailwind config — a deliberate copy of apps/crm/real-estate-crm-app/tailwind.config.js.
 *
 * The Instagram console renders inside the same CloudFront distribution as the
 * CRM and has to read as the same product. The token values below mirror
 * marketing-and-sales/realestateflow/design-tokens.json and .brand/brand-kit.md
 * (primary #2563EB). If the CRM's palette changes, change it here too.
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
