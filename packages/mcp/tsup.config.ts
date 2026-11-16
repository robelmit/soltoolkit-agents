import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    target: 'node20',
    splitting: false,
  },
  {
    // The command-line entry: `soltoolkit-mcp`, the stdio server.
    entry: ['src/cli.ts'],
    format: ['esm'],
    dts: false,
    clean: false,
    sourcemap: true,
    target: 'node20',
    splitting: false,
    banner: { js: '#!/usr/bin/env node' },
  },
]);
