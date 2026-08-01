import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  ssr: {
    noExternal: true,
  },
  build: {
    target: "node22",
    outDir: ".output/server",
    emptyOutDir: true,
    copyPublicDir: false,
    ssr: "./server/hono/entry.ts",
    rolldownOptions: {
      output: {
        entryFileNames: "index.mjs",
        chunkFileNames: "chunks/[name]-[hash].mjs",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
