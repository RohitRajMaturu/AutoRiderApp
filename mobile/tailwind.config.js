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
          saffron: '#43B8B3',
          saffronDark: '#339E9A',
          cream: '#EAF0F1',
          ink: '#17272B',
          green: '#138808',
        },
      },
    },
  },
  plugins: [],
};
