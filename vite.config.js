import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deployed at bina-plus.co.il/app/ (isolated subfolder) until ai.bina-plus.co.il exists.
export default defineConfig({
  plugins: [react()],
  base: '/app/',
})
