import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'logo.png'],
      manifest: {
        name: 'SafeTrip VN - Cảnh báo xe khách an toàn',
        short_name: 'SafeTrip VN',
        description: 'Giám sát lộ trình real-time, cảnh báo biên giới, SOS khẩn cấp, tra cứu xe lừa đảo',
        theme_color: '#0F172A',
        background_color: '#0F172A',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Web Push (v1.34): public/push-sw.js only ADDS the push +
        // notificationclick listeners to this generated SW; precache and
        // runtime caching below are untouched.
        importScripts: ['/push-sw.js'],
        globPatterns: ['**/*.{js,css,html,svg,png,webp}'],
        // The Mapbox GL chunk is loaded on demand only when a token is
        // configured (v1.25) — never precache it for Leaflet-only users.
        globIgnores: ['**/mapbox-gl-*.{js,css}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'osm-tiles', expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 } },
          },
        ],
      },
    }),
  ],
  server: { host: true, port: 5173 },
});
