import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Site servi à la racine de restiq-app.ca (et des sous-domaines hectare.restiq-app.ca).
  base: "/",
});
