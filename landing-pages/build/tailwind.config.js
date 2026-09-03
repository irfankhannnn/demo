/** @type {import('tailwindcss').Config} */
export default {
  // Scan LP HTML pages and the shared .hbs partials so utility classes used
  // anywhere in the landing pages are compiled into dist/assets/main.css.
  content: [
    '../**/*.html',
    '../_partials/**/*.hbs',
    '!../dist/**',
    '!../build/**',
    '!../node_modules/**',
  ],
  theme: {
    extend: {
      colors: {
        // RealEstateFlow brand palette (matches existing index.html config)
        primary: '#FF7A1A',
        accent: '#22C55E',
        navy: '#1C1512',
        dark: '#1C1512',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
