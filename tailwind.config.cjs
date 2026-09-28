/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    extend: {
      colors: {
        'pop-blue': '#60A5FA',
        'pop-red': '#F87171',
        'pop-yellow': '#FACC15',
        'pop-dark': '#111827',
        'pop-purple': '#A855F7',
        'pop-blueLight': '#DBEAFE',
      },

      boxShadow: {
        neo: '6px 6px 0px #000',
        'neo-sm': '4px 4px 0px #000',
        'neo-lg': '8px 8px 0px #000',
      },

      borderWidth: {
        3: '3px',
        6: '6px',
      },

      borderRadius: {
        '4xl': '2rem',
      }
    },
  },

  plugins: [],
}