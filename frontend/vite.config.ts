// Issue #30: this config compiles WITHOUT @types/node (zero-dependency
// guardrail), so the execSync import below needs the ambient node shims
// declared in src/vite-env.d.ts. That file is a global-script declaration
// file, not a module — a path reference is the only way to pull it in here
// (an `import type` fails with TS2306), hence the justified rule disable.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./src/vite-env.d.ts" />
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
