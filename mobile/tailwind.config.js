/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './App.web.{js,jsx,ts,tsx}',
    './index.{js,jsx,ts,tsx}',
    './index.web.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        autoconnect: {
          saffron: '#F97316',
          saffronDark: '#EA580C',
          cream: '#FFFBF5',
          ink: '#1C1917',
          green: '#138808',
        },
      },
    },
  },
  plugins: [],
};
