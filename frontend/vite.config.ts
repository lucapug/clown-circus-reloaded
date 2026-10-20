import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Issue #30: the app git sha baked into recorded session headers — traces
// are version-bound and replay validates against it. The try/catch keeps
// tarball checkouts (no git) from crashing the dev server.
const gitSha = (() => {
  try {
    return execSync('git rev-parse HEAD').toString().trim()
  } catch {
    return 'unknown'
  }
})()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_GIT_SHA__: JSON.stringify(gitSha),
  },
})
