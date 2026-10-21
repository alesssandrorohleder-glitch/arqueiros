import { defineConfig } from 'vite';

export default defineConfig({
  // Data/hora do build, mostrada na tela de pausa para conferir a versão.
  define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
  base: './',
  server: { port: 5174 },
  // O Three.js sozinho passa de 500 kB; não é um problema para um jogo.
  build: { chunkSizeWarningLimit: 1200 },
});
