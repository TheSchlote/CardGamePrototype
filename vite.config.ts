import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  // Use the repo name so GitHub Pages serves assets from /CardGamePrototype/
  base: "/CardGamePrototype/",
  plugins: [react()],
  resolve: {
    alias: {
      "@engine": path.resolve(__dirname, "src/engine"),
      "@engine/*": path.resolve(__dirname, "src/engine/*"),
      "@ui": path.resolve(__dirname, "src/ui"),
      "@data": path.resolve(__dirname, "src/data")
    }
  }
});
