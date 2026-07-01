/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // "Secuestramos" el color blue predeterminado de Tailwind
        blue: {
          50: '#ebf4ff',
          100: '#cce3ff',
          400: '#3385ff',
          500: '#0066cc',
          600: '#0055af', // <-- Tu Azul Corporativo ORE (Afecta a todos los botones principales)
          700: '#003d80',
        },
        // "Secuestramos" el color amber/yellow para tus acentos e íconos de marca
        amber: {
          50: '#fffdf0',
          100: '#fff9cc',
          400: '#ffe866',
          500: '#ffdd1c', // <-- Tu Amarillo Corporativo ORE
          600: '#e6c200',
          700: '#b39200',
        }
      },
    },
  },
  plugins: [],
}