import path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Dev: Vite serves the UI on :5174 and proxies /api to the API server.
// Prod: `vite build` output is served by the API server itself (single service).
const port = Number(process.env.DEALPILOT_WEB_PORT ?? 5174);
const apiTarget = process.env.DEALPILOT_API_URL ?? "http://localhost:8090";

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: { "/api": { target: apiTarget, changeOrigin: false } },
  },
  preview: { port, host: "0.0.0.0", proxy: { "/api": { target: apiTarget, changeOrigin: false } } },
});
