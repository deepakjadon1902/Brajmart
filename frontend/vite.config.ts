import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ isSsrBuild, mode }) => ({
  server: {
    host: "::",
    port: 8081,
    strictPort: false,
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
    },
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), {
    name: 'brajmart-tracking-policy',
    transformIndexHtml: (html: string) => html.replace('"__BRAJMART_LEGACY_GTM__"', String(loadEnv(mode, process.cwd(), 'VITE_').VITE_ENABLE_LEGACY_GTM === 'true')),
  }],
  ssr: {
    noExternal: ['react-helmet-async', 'next-themes'],
  },
  build: {
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: isSsrBuild ? undefined : {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query", "zustand"],
          carousel: ["embla-carousel-react", "embla-carousel-autoplay"],
          icons: ["lucide-react"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
