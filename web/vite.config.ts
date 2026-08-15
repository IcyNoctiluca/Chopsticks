import { defineConfig } from "vite";

export default defineConfig({
  root: "web",
  build: {
    outDir: "../dist-web",
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
  },
});