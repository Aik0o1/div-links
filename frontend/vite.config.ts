import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIRNAME = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: DIRNAME,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(DIRNAME, "src"),
    },
  },
  build: {
    outDir: path.resolve(DIRNAME, "../src/servidor/public"),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:3400",
    },
  },
});
