import { defineConfig } from "vite";

export default defineConfig({
  root: "web",
  build: {
    outDir: "../dist-web",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: "web/index.html",
        online: "web/online.html",
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
      },
    },
  },
});