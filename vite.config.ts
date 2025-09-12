import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import type { MinifyOptions } from 'terser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    }
  },
  build: {
    target: 'es2022',
    // Enable tree-shaking and minification optimizations
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    } satisfies MinifyOptions,
    rollupOptions: {
      output: {
        manualChunks: {
          // Keep React separate for better caching
          react: ['react', 'react-dom'],
          // Split CodeMirror core from language-specific packages
          'codemirror-core': [
            '@codemirror/state',
            '@codemirror/view', 
            '@codemirror/commands'
          ],
          'codemirror-lang': [
            '@codemirror/lang-markdown'
          ],
          // Keep Turndown lazy-loaded since it's only used for paste
          turndown: ['turndown'],
        }
      }
    }
  }
})
