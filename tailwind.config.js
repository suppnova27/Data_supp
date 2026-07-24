/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f0f8',
          100: '#e8ddf0',
          200: '#d4bfe0',
          300: '#b494c8',
          400: '#8e6aad',
          500: '#6b4590',
          600: '#4a1a5e',
          700: '#341645',
          800: '#2a1038',
          900: '#1a0a25',
        },
        gold: {
          50: '#fdf9ed',
          100: '#f8eece',
          200: '#f0dc9a',
          300: '#e8d48b',
          400: '#d4b45e',
          500: '#c9a84c',
          600: '#b08a2e',
          700: '#8c6d24',
          800: '#6b531c',
          900: '#4a3a14',
        },
      },
    },
  },
  plugins: [],
}
