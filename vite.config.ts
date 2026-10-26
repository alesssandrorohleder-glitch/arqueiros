import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Data/hora do build, mostrada na tela de pausa para conferir a versão.
  define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
  base: './',
  server: { port: 5174 },
  // O Three.js sozinho passa de 500 kB; não é um problema para um jogo.
  build: { chunkSizeWarningLimit: 1200 },
  plugins: [
    // PWA: instalável (tela inicial / área de trabalho) e jogável offline contra bots.
    // O service worker guarda todos os arquivos do jogo (código, modelos 3D, ícones) e
    // se atualiza sozinho quando sai uma versão nova. O online (/ws) e a conta (Supabase)
    // continuam indo para a rede.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Arqueiros',
        short_name: 'Arqueiros',
        description: 'Batalha de arqueiros em 3D: personagens, habilidades, bots e partidas online.',
        lang: 'pt-BR',
        start_url: './',
        scope: './',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#1e3a26',
        theme_color: '#1e3a26',
        categories: ['games'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,glb,webmanifest}'],
        // O código do jogo (Three.js + jogo) tem ~1,1 MB.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        // Nunca responder pelo service worker: jogo online, saúde do servidor.
        navigateFallbackDenylist: [/^\/ws/, /^\/health/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
});
