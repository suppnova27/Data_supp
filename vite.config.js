import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Permite acceder al dev server mediante túneles públicos (validación con clientes).
  // Puedes eliminar esta sección si no vas a usar túneles.
  server: {
    allowedHosts: ['.loca.lt', '.trycloudflare.com', 'bore.pub'],
  },
  preview: {
    allowedHosts: ['.loca.lt', '.trycloudflare.com', 'bore.pub'],
  },
})
