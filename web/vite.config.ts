import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { handleApi } from "./server/api.ts";

export default defineConfig(({ mode }) => {
  // Make ANTHROPIC_* from .env visible to the API handler (the browser never sees them).
  for (const [k, v] of Object.entries(loadEnv(mode, process.cwd(), "ANTHROPIC_"))) process.env[k] ??= v;

  return {
    plugins: [
      react(),
      {
        name: "signa-api",
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            handleApi(req, res).then((handled) => handled || next(), next);
          });
        },
        configurePreviewServer(server) {
          server.middlewares.use((req, res, next) => {
            handleApi(req, res).then((handled) => handled || next(), next);
          });
        },
      },
    ],
    server: { port: 5173 },
  };
});
