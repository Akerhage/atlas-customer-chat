import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => ({
  // VIKTIGT: Måste vara exakt "/kundchatt/" för att routing ska funka
  base: "/kundchatt/", 
  esbuild: {
    charset: "ascii",
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    {
      name: "atlas-normalize-html-line-endings",
      enforce: "post",
      transformIndexHtml: {
        order: "post",
        handler(html) {
          return html.replace(/\r\n?/g, "\n");
        },
      },
    },
    // Här låg lovable-tagger förut - nu borta för att undvika byggfel
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
