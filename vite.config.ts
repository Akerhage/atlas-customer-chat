import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => ({
  // VIKTIGT: Måste vara exakt "/kundchatt/" för att routing ska funka
  base: "/kundchatt/", 
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    // Här låg lovable-tagger förut - nu borta för att undvika byggfel
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));