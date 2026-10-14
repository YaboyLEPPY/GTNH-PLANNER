import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Codespaces forwards the private preview through this exact host.
const codespacesHost = process.env.CODESPACE_NAME
  ? `${process.env.CODESPACE_NAME}-5173.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || "app.github.dev"}`
  : undefined;
export default defineConfig({
  plugins: [react()],
  build: { chunkSizeWarningLimit: 500 },
  server: {
    host: "0.0.0.0",
    allowedHosts: codespacesHost ? [codespacesHost] : [],
  },
});
