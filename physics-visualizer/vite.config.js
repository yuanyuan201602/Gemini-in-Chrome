import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Build into a single self-contained HTML file so it can be opened offline
// in a classroom by double-clicking, without a web server or network.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 5000,
  },
});
