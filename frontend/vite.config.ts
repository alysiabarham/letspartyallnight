// frontend/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2015", // Safari needs ES2015+
  },
  server: {
    proxy: {
      "/socket.io": {
        target: "https://letspartyallnight-backend.onrender.com",
        ws: true,
      },
    },
  },
});
