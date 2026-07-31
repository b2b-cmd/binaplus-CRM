import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Deployed at bina-plus.co.il/app/ (isolated subfolder) until ai.bina-plus.co.il exists.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/app/',
  resolve: {
    // '@' is what the ported shadcn/admin components import from.
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
