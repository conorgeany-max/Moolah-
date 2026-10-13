import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Emits a small, dependency-free service worker that precaches every file in the
 * production build. The cache name is derived from the file list and contents, so
 * each deploy produces a new cache and the old one is removed on activation.
 */
function precacheServiceWorker(): Plugin {
  return {
    name: 'precache-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const publicDir = join(process.cwd(), 'public')
      const publicFiles: string[] = []
      const walk = (dir: string) => {
        for (const entry of readdirSync(dir)) {
          const full = join(dir, entry)
          if (statSync(full).isDirectory()) walk(full)
          else publicFiles.push(relative(publicDir, full).split('\\').join('/'))
        }
      }
      walk(publicDir)
      const files = [...Object.keys(bundle), ...publicFiles].filter((f) => f !== 'sw.js' && !f.endsWith('.map'))
      const hash = createHash('sha256')
      for (const name of Object.keys(bundle).sort()) {
        const chunk = bundle[name]
        hash.update(name)
        hash.update(chunk.type === 'chunk' ? chunk.code : typeof chunk.source === 'string' ? chunk.source : Buffer.from(chunk.source))
      }
      for (const f of publicFiles.sort()) hash.update(f).update(readFileSync(join(publicDir, f)))
      const version = hash.digest('hex').slice(0, 12)
      const template = readFileSync(join(process.cwd(), 'src/sw-template.js'), 'utf8')
      const source = template
        .replace('__CACHE_VERSION__', version)
        .replace('__PRECACHE_FILES__', JSON.stringify(['./', ...files.map((f) => './' + f)]))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), precacheServiceWorker()],
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Separate long-lived chunks so app updates don't re-download React or the exercise library.
        manualChunks: (id) => (id.includes('node_modules') ? 'vendor' : id.includes('/src/data/') ? 'data' : undefined),
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
} as import('vite').UserConfig)
