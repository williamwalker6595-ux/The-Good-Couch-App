import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBase = env.VITE_API_BASE_URL ?? "";

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: "prompt",
        includeAssets: ["favicon.svg", "apple-touch-icon.png"],
        manifest: {
          name: "The Good Couch — Lead Dashboard",
          short_name: "Good Couch",
          description:
            "Lead pipeline, quotes, and scheduling for The Good Couch couch-pickup business.",
          theme_color: "#ffffff",
          background_color: "#f7f7f5",
          display: "standalone",
          orientation: "portrait",
          start_url: "/",
          scope: "/",
          icons: [
            { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
            { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
            {
              src: "maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          // Only add runtime caching for the API host when we actually know
          // it (VITE_API_BASE_URL is set at build time) — an empty pattern
          // would otherwise match every request.
          runtimeCaching: apiBase
            ? [
                {
                  urlPattern: new RegExp(
                    `^${escapeRegExp(apiBase)}/media/proxy`,
                  ),
                  handler: "CacheFirst",
                  options: {
                    cacheName: "lead-photos",
                    expiration: {
                      maxEntries: 300,
                      maxAgeSeconds: 60 * 60 * 24 * 30,
                    },
                  },
                },
                {
                  urlPattern: new RegExp(`^${escapeRegExp(apiBase)}/`),
                  handler: "NetworkFirst",
                  options: {
                    cacheName: "api-cache",
                    networkTimeoutSeconds: 4,
                    expiration: {
                      maxEntries: 200,
                      maxAgeSeconds: 60 * 60 * 24,
                    },
                    cacheableResponse: { statuses: [0, 200] },
                  },
                },
              ]
            : [],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
  };
});
