/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        masters: {
          green: '#006747',
          yellow: '#f5e642',
          dark: '#1a3a2a',
        },
      },
    },
  },
  plugins: [],
};
