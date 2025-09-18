import { io } from "socket.io-client";

const backendUrl =
  import.meta.env.VITE_BACKEND_URL ||
  "https://letspartyallnight-backend.onrender.com";

export const socket = io(backendUrl, {
  transports: ["websocket"],
  withCredentials: true,
});
