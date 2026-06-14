/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: '#01696f',
          light: '#4a9ca0',
          dark: '#004c50',
        },
      },
    },
  },
  plugins: [],
};
