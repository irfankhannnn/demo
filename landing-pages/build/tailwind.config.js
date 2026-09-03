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
        primary: '#22C55E',
        navy: '#0F3A66',
        dark: '#07111E',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
