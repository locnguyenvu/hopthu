import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'
import { DEFAULT_TIMEZONE } from './src/constants.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    preact(),
    tailwindcss(),
    {
      name: 'html-transform',
      transformIndexHtml(html) {
        const appRoot = process.env.QUART_APPLICATION_ROOT || '/';
        return html.replace(
          '<base href="/" />',
          `<base href="${appRoot}" />`
        );
      },
    },
  ],
  resolve: {
    alias: {
      'react': 'preact/compat',
      'react-dom': 'preact/compat',
    },
  },
  define: {
    'APP_TZ': JSON.stringify(process.env.QUART_TZ || DEFAULT_TIMEZONE),
    'API_BASE': JSON.stringify(process.env.QUART_APPLICATION_ROOT || '/'),
  },
  base: process.env.QUART_APPLICATION_ROOT || '/', // Ensure assets are loaded from the correct base path
  build: {
    outDir: '../src/hopthu/app/static',
    emptyOutDir: true,
  },
  server: {
    host: true, // Allows access from any device on the network
    port: 5173,
    strictPort: true, // Ensures Vite uses the exact port specified
    proxy: {
      '/api': 'http://localhost:5174',
      '/login': 'http://localhost:5174',
    },
  },
})
