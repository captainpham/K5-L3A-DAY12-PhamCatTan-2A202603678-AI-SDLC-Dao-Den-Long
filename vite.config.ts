import { defineConfig } from "vite";

// Web build of the windowed game. Output: dist/web (static folder, runs on any OS with a browser).
export default defineConfig({
  root: ".",
  base: "./",
  build: { outDir: "dist/web", emptyOutDir: true },
  preview: { port: 4173 },
  test: { include: ["tests/**/*.test.ts"], globalSetup: ["tests/global-setup.ts"] },
} as any);
