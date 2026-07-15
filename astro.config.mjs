import { defineConfig } from "astro/config";

// GitHub Pages: Projekt-Site läuft unter https://<user>.github.io/<repo>/
// Lokal (npm run dev / build ohne CI) bleibt base "/".
const repo = process.env.GITHUB_REPOSITORY; // z. B. "manuelfdrescher-lgtm/capital-compass"
const [owner, repoName] = repo ? repo.split("/") : [];

export default defineConfig({
  site: owner ? `https://${owner}.github.io` : "http://localhost:4321",
  base: repoName ? `/${repoName}` : "/",
  trailingSlash: "ignore",
  build: {
    format: "directory",
  },
});
