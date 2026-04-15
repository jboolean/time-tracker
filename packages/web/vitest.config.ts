import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    name: "web",
    environment: "jsdom",
    globals: true,
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.test.tsx", "tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@time-tracker/shared": path.resolve(__dirname, "../shared/src/index.ts"),
    },
  },
});
