import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html'
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    },
    target: 'es2020'
  },
  worker: {
    format: 'es'
  },
  define: {
    global: 'globalThis'
  },
  server: {
    port: 5173,
    host: true
  },
  optimizeDeps: {
    include: [
      'monaco-editor',
      'monaco-languageclient',
      'vscode-languageserver',
      'vscode-languageserver-textdocument'
    ]
  }
});