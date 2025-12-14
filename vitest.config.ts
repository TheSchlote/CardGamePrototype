import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@engine": path.resolve(__dirname, "src/engine"),
      "@engine/*": path.resolve(__dirname, "src/engine/*"),
      "@ui": path.resolve(__dirname, "src/ui"),
      "@data": path.resolve(__dirname, "src/data")
    }
  },
  test: {
    globals: true,
    // Engine tests don't need DOM; node avoids jsdom ESM/parse5 issues
    environment: "node",
    setupFiles: "./vitest.setup.ts",
    coverage: {
      reporter: ["text", "html"],
      provider: "v8",
      include: ["src/engine/**/*.ts"],
      exclude: ["src/engine/index.ts", "src/engine/types.ts"]
    }
  }
});
