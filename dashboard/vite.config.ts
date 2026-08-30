import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Sur GitHub Pages l’adresse est …github.io/NOM-DU-REPO/  → on met ce préfixe via VITE_BASE_PATH
  base: process.env.VITE_BASE_PATH || "/",
});
