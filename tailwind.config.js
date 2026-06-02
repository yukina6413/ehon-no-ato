/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sage: {
          50:  '#f6f7f4',
          100: '#e8ece3',
          200: '#d1d9c8',
          300: '#aab89a',
          400: '#85986e',
          500: '#677c53',
          600: '#516241',
        }
      }
    },
  },
  plugins: [],
}
