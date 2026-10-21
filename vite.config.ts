import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5174 },
  // O Three.js sozinho passa de 500 kB; não é um problema para um jogo.
  build: { chunkSizeWarningLimit: 1200 },
});
