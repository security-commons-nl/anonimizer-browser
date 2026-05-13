import { defineConfig } from "vite";

// GitHub Pages serveert vanaf https://<org>.github.io/anonimizer-browser/
// dus assets moeten relatieve paden krijgen. Set GITHUB_PAGES=1 in CI
// om de base te activeren.
export default defineConfig({
  base: process.env.GITHUB_PAGES === "1" ? "/anonimizer-browser/" : "/",
  build: {
    target: "es2022",
    sourcemap: false,
  },
});
