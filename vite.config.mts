import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Config Vite — SPA mobile-first. El proxy de /api solo aplica en `vite dev`;
// en producción (Vercel) las funciones serverless conviven en el mismo dominio.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
