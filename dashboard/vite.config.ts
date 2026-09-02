import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // GitHub Pages : …github.io/hectare/  (VITE_BASE_PATH fourni par Actions)
  base: process.env.VITE_BASE_PATH || "/",
});
