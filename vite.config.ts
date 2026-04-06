import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  optimizeDeps: {
    // Prevent Vite from pre-bundling packages that have deep pnpm
    // virtual-store dependencies which aren't hoisted to root node_modules.
    exclude: [
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      'framer-motion',
      'motion',
      'motion-dom',
      'motion-utils',
    ],
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  // Proxy API requests to local Node.js server in development
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
