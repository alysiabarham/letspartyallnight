// src/socket.ts
import { io } from "socket.io-client";

const getBackendUrl = () => {
  const url = import.meta.env.VITE_BACKEND_URL;
  console.log("🧪 VITE_BACKEND_URL at runtime:", url);
  return url || "https://letspartyallnight-backend.onrender.com";
};

export const socket = io(getBackendUrl(), {
  transports: ["websocket"],
  autoConnect: true,
});
