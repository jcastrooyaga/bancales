/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1F568C',
          dark: '#184676',
          darker: '#123460',
          light: '#2666a2',
        },
      },
    },
  },
  plugins: [],
};
