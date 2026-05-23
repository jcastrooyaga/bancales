/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1565a8',
          dark: '#0f4e8a',
          darker: '#0b3d6d',
          light: '#1a75be',
        },
      },
    },
  },
  plugins: [],
};
