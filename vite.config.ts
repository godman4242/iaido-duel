import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: true,
    // Don't full-reload the running game when non-source files change (SDD ledger/diffs,
    // docs, gitignored study material). Only src changes should trigger HMR.
    watch: { ignored: ['**/.superpowers/**', '**/docs/**', '**/reference/**', '**/.git/**'] },
  },
});
