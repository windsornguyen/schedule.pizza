import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [cloudflare(), tailwindcss(), reactRouter()],
  environments: {
    sched: {
      resolve: {
        dedupe: ["react", "react-dom", "react-router"],
      },
      optimizeDeps: {
        include: [
          "react-dom/server.edge",
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
        ],
      },
    },
  },
});
