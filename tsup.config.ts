import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/cli.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'node18',
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  {
    entry: ['src/hooks/scripts/*.ts'],
    format: ['esm'],
    outDir: 'dist/hooks',
    sourcemap: true,
    target: 'node18',
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
])
