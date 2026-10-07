import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      // Step 3 (2026-09-11): /gesture-synth is a second entry mounting the
      // same main.tsx — one instrument, two URLs. Bundles are shared chunks.
      input: {
        main: 'index.html',
        gestureSynth: 'gesture-synth.html',
      },
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
  server: {
    port: 3000,
  },
  // Self-hosted via PM2 (ecosystem.config.cjs → vite preview on 3007).
  // Vite blocks unknown Host headers; leading dot = domain + all subdomains
  // (e.g. music.xn--w8yuyt86b.tw).
  preview: {
    allowedHosts: ['.xn--w8yuyt86b.tw'],
  },
  test: {
    environment: 'jsdom',
  },
})
