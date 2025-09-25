import { io } from "socket.io-client";

const backendUrl =
  import.meta.env.VITE_BACKEND_URL ||
  "https://letspartyallnight-backend.onrender.com";

export const socket = io(backendUrl, {
  transports: ["websocket"],
  withCredentials: true,
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

socket.on("connect", () => {
  console.log("📡 Socket initialized:", socket.id);
});

socket.on("connect_error", (error) => {
  console.error("🚫 Socket connect error:", error.message);
});

socket.on("reconnect_attempt", (attempt) => {
  console.log("📡 Socket reconnect attempt:", attempt);
});
