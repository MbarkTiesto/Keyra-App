import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    nodePolyfills({
      include: ['buffer', 'crypto', 'stream', 'util', 'process']
    })
  ],
  build: {
    outDir: 'dist',
    target: 'es2020'
  },
  server: {
    proxy: {
      '/.netlify': {
        target: 'https://keyraapp.netlify.app',
        changeOrigin: true,
        secure: true
      }
    }
  }
});
