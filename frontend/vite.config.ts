import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const builtAt = new Date().toISOString()
const version = builtAt.replace(/[-:T]/g, '').slice(0, 12)
const commit = process.env.VITE_GIT_COMMIT_SHA || 'build-' + Math.random().toString(36).substring(2, 9)

// Custom plugin to generate version.json in dist/
function generateVersionJson() {
  return {
    name: 'generate-version-json',
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist')
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true })
      }
      fs.writeFileSync(
        path.join(outDir, 'version.json'),
        JSON.stringify({ version, commit, builtAt }, null, 2)
      )
      console.log('Generated version.json successfully')
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), generateVersionJson()],
  define: {
    __APP_VERSION_INFO__: JSON.stringify({ version, commit, builtAt })
  },
  server: {
    port: 5173,
    host: true
  }
})

