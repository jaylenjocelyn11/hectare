import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Domaine perso restiq-app.ca : assets à la racine.
  base: "/",
});
