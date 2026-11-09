import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Settings come from .env (see .env.example) or the environment:
//   API_URL    where /api and /probe go: a scanner replica, or a load balancer
//              in front of the replicas. The browser always calls the panel's
//              own origin; the dev server here (and nginx in the image) forwards.
//   PANEL_URL  the address the panel is served at. Its path is the base path of
//              the build (for example https://ops.example/scanner/); its host
//              and port are where `npm run dev` listens.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiURL = env.API_URL || "http://127.0.0.1:8080";
  const panelURL = new URL(env.PANEL_URL || "http://localhost:5173/");
  return {
    base: panelURL.pathname.endsWith("/") ? panelURL.pathname : `${panelURL.pathname}/`,
    plugins: [react()],
    server: {
      host: panelURL.hostname,
      port: Number(panelURL.port) || 5173,
      proxy: {
        "/api": apiURL,
        "/probe": apiURL,
      },
    },
  };
});
