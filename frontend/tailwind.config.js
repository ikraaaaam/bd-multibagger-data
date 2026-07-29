/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'tv-bg': '#131722',
        'tv-panel': '#1e222d',
        'tv-border': '#2a2e39',
        'tv-text': '#d1d4dc',
        'tv-text-dim': '#787b86',
        'tv-green': '#26a69a',
        'tv-red': '#ef5350',
        'tv-blue': '#2962ff',
      }
    },
  },
  plugins: [],
}
