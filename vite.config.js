import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    // Permite acesso via domínio de preview do ambiente (*.monkeycode-ai.live)
    allowedHosts: ['.monkeycode-ai.live'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
})
