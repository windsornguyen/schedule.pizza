import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    reactRouter(),
    babel({
      include: /\.[jt]sx?$/,
      plugins: ["babel-plugin-react-compiler"],
    }),
  ],
  environments: {
    ssr: {
      optimizeDeps: {
        include: ["react/compiler-runtime"],
      },
    },
  },
});
