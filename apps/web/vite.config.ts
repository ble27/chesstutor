import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "browser-engine-assets",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.url?.startsWith("/engine/stockfish-17.1-"))
            response.setHeader(
              "Cache-Control",
              "public, max-age=31536000, immutable",
            );
          next();
        });
      },
    },
  ],
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    port: 5173,
    strictPort: true,
    proxy: { "/api": process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8000" },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test-setup.ts"],
    restoreMocks: true,
    unstubGlobals: true,
  },
});
