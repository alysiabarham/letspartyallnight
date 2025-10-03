import React, { useState, useEffect } from "react";
import {
  VStack,
  Heading,
  Text,
  Input,
  Button,
  useToast,
  Select,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { socket } from "../socket";
import { AxiosError } from "axios";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

export default function EnterRoom() {
  const [role, setRole] = useState<"player" | "spectator">("player");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isSocketConnected, setIsSocketConnected] = useState(socket.connected);
  const [socketIdReady, setSocketIdReady] = useState(socket.id !== undefined);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    console.log("🧪 EnterRoom socket status:", {
      connected: socket.connected,
      id: socket.id,
    });

    socket.on("connect", () => {
      setIsSocketConnected(true);
      setSocketIdReady(true);
      console.log("✅ Socket connected:", socket.id);
      socket.emit("checkSocketId", { socketId: socket.id });
    });
    socket.on("disconnect", () => {
      setIsSocketConnected(false);
      setSocketIdReady(false);
      console.log("❌ Socket disconnected");
    });
    socket.on("connect_error", (error) => {
      console.error("🚫 Socket connect error:", error.message);
      toast({
        title: "Socket connection failed.",
        description: "Retrying connection...",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    });

    if (!socket.connected) {
      console.log("🧪 Forcing socket connection...");
      socket.connect();
    }

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
    };
  }, []);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, "");
    console.log("🧪 handleNameChange:", { value: e.target.value, cleaned });
    setPlayerName(cleaned);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRoomCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ""));
  };

  const handleCreateRoom = async () => {
    console.log("🧪 handleCreateRoom triggered", {
      playerName,
      socketId: socket.id,
    });

    if (!playerName.trim()) {
      console.log("🧪 No player name provided");
      toast({
        title: "Enter your name.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (!isSocketConnected || !socketIdReady || !socket.id) {
      console.log("🧪 Socket not ready:", {
        isSocketConnected,
        socketIdReady,
        id: socket.id,
      });
      toast({
        title: "Connecting to server...",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      localStorage.removeItem("alreadyJoined");
      localStorage.removeItem("playerName");
      localStorage.removeItem("isHost");
      localStorage.removeItem("role");
      console.log("🧹 Cleared localStorage");

      const hostId = socket.id;
      const hostName = playerName.trim();
      const payload = { hostId, hostName };
      console.log("🧪 Building payload:", { hostId, hostName });
      console.log("🧪 FINAL Axios payload:", payload);

      const response = await axios.post(`${backendUrl}/create-room`, payload, {
        headers: { "Content-Type": "application/json" },
      });

      const { roomCode } = response.data;
      console.log("📍 Created room:", { roomCode, hostId, hostName });

      localStorage.setItem("alreadyJoined", roomCode);
      localStorage.setItem("playerName", hostName);
      localStorage.setItem("isHost", "true");
      localStorage.setItem("role", role);
      console.log("📍 Set localStorage:", {
        roomCode,
        playerName: hostName,
        isHost: true,
        role,
      });

      const joinPromise = new Promise((resolve, reject) => {
        socket.once(
          "playerJoined",
          ({ success, roomCode: joinedCode, playerName }) => {
            console.log("📡 Received playerJoined:", {
              success,
              roomCode: joinedCode,
              playerName,
            });
            if (success && joinedCode === roomCode && playerName === hostName) {
              resolve(true);
            } else {
              reject(new Error("Failed to confirm join"));
            }
          }
        );
        socket.once("joinError", ({ message }) => {
          console.log("📡 Received joinError:", message);
          reject(new Error(message));
        });
      });

      socket.emit("joinGameRoom", { roomCode, playerName: hostName });
      socket.emit("setRole", { roomCode, playerName: hostName, role });
      console.log("📡 Sent joinGameRoom and setRole:", {
        roomCode,
        playerName: hostName,
        role,
      });

      await joinPromise;

      if (!toast.isActive(`create-room-${roomCode}`)) {
        toast({
          id: `create-room-${roomCode}`,
          title: "Room created and joined!",
          description: `Code: ${roomCode}`,
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      }

      navigate(`/room/${roomCode}`, {
        state: { playerName: hostName, isHost: true },
      });
      console.log("🚀 Navigated to room:", roomCode);
    } catch (error: unknown) {
      const err = error as AxiosError;
      console.error("🚫 Create/Join error:", err.response?.data || err.message);
      localStorage.removeItem("alreadyJoined");
      localStorage.removeItem("playerName");
      localStorage.removeItem("isHost");
      localStorage.removeItem("role");
      toast({
        title: "Error creating room.",
        description:
          typeof err.response?.data === "object" &&
          err.response?.data !== null &&
          "error" in err.response.data
            ? (err.response.data as { error: string }).error
            : err.message || "Try again later.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleJoinRoom = async () => {
    console.log("🧪 handleJoinRoom triggered", {
      roomCode,
      playerName,
      socketId: socket.id,
    });

    if (!playerName.trim() || !roomCode.trim()) {
      console.log("🧪 Missing name or code");
      toast({
        title: "Enter name and code.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (!isSocketConnected || !socketIdReady || !socket.id) {
      console.log("🧪 Socket not ready for join:", {
        isSocketConnected,
        socketIdReady,
        id: socket.id,
      });
      toast({
        title: "Connecting to server...",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      const playerId = playerName.trim();
      const upperRoomCode = roomCode.trim().toUpperCase();
      console.log("📍 Sending /join-room:", {
        roomCode: upperRoomCode,
        playerId,
        socketId: socket.id,
      });

      const response = await axios.post(`${backendUrl}/join-room`, {
        roomCode: upperRoomCode,
        playerId,
        socketId: socket.id,
      });

      const { room } = response.data;
      console.log("📍 Join-room response:", { roomCode: room.code, playerId });

      const joinPromise = new Promise((resolve, reject) => {
        socket.once(
          "playerJoined",
          ({ success, roomCode: joinedCode, playerName }) => {
            console.log("📡 Received playerJoined:", {
              success,
              roomCode: joinedCode,
              playerName,
            });
            if (
              success &&
              joinedCode === room.code &&
              playerName === playerId
            ) {
              resolve(true);
            } else {
              reject(new Error("Failed to confirm join"));
            }
          }
        );
        socket.once("joinError", ({ message }) => {
          console.log("📡 Received joinError:", message);
          reject(new Error(message));
        });
      });

      socket.emit("joinGameRoom", {
        roomCode: room.code,
        playerName: playerId,
      });
      socket.emit("setRole", {
        roomCode: room.code,
        playerName: playerId,
        role,
      });
      console.log("📡 Sent joinGameRoom and setRole:", {
        roomCode: room.code,
        playerName: playerId,
        role,
      });

      await joinPromise;

      localStorage.setItem("alreadyJoined", room.code);
      localStorage.setItem("playerName", playerId);
      localStorage.setItem("isHost", "false");
      localStorage.setItem("role", role);

      if (!toast.isActive(`join-room-${room.code}`)) {
        toast({
          id: `join-room-${room.code}`,
          title: "Room joined!",
          description: `Joined: ${room.code}`,
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      }

      navigate(`/room/${room.code}`, {
        state: { playerName: playerId, isHost: false },
      });
      console.log("🚀 Navigated to room:", room.code);
    } catch (error: unknown) {
      const err = error as AxiosError;
      console.error("🚫 Join error:", err.response?.data || err.message);
      toast({
        title: "Join failed.",
        description:
          typeof err.response?.data === "object" &&
          err.response?.data !== null &&
          "error" in err.response.data
            ? (err.response.data as { error: string }).error
            : err.message || "Room not found or full.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <VStack spacing={8} p={8} minH="100vh" justifyContent="center" bg="#0F0F1E">
      <Heading
        size="3xl"
        className="rank-title"
        style={{ fontFamily: "Vivaldi" }}
      >
        Rank the Topic
      </Heading>
      <Text
        fontSize="2xl"
        className="sub-heading"
        style={{ fontFamily: "ScreamingNeon" }}
      >
        Enter the Party Zone 🎉
      </Text>
      <Text className="sub-heading" color="white">
        Room: {roomCode || "Not set"}
      </Text>

      <Input
        placeholder="Your Name"
        value={playerName}
        onChange={handleNameChange}
        size="lg"
        w="300px"
        textAlign="center"
        color="#00FFFF"
        borderColor="#00FFFF"
        _focus={{ borderColor: "#00FFFF", boxShadow: "0 0 5px #00FFFF" }}
        _placeholder={{ color: "#00FFFF", opacity: 0.7 }}
        pattern="^[a-zA-Z0-9]*$"
        title="Letters and numbers only"
      />

      <Button
        onClick={() => {
          console.log("🧪 Create Room button clicked", {
            playerName,
            socketId: socket.id,
          });
          handleCreateRoom();
        }}
        size="lg"
        w="200px"
        bg="transparent"
        color="#FF00FF"
        border="2px solid #FF00FF"
        boxShadow="0 0 15px #FF00FF"
        _hover={{ bg: "rgba(255,0,255,0.1)", boxShadow: "0 0 20px #FF00FF" }}
        isDisabled={!isSocketConnected || !socketIdReady || !playerName.trim()}
      >
        CREATE ROOM
      </Button>

      <Text fontSize="lg" color="white">
        OR
      </Text>

      <Input
        placeholder="Room Code"
        value={roomCode}
        onChange={handleCodeChange}
        size="lg"
        w="300px"
        textAlign="center"
        color="#FFFF00"
        borderColor="#FFFF00"
        _focus={{ borderColor: "#FFFF00", boxShadow: "0 0 5px #FFFF00" }}
        _placeholder={{ color: "#FFFF00", opacity: 0.7 }}
        pattern="^[a-zA-Z0-9]*$"
        title="Alphanumeric only"
      />

      <Text fontSize="lg" color="white">
        Choose your role:
      </Text>

      <Select
        value={role}
        onChange={(e) => setRole(e.target.value as "player" | "spectator")}
        bg="#1A1A2E"
        color="#FFFF00"
        borderColor="#FFFF00"
        _hover={{ borderColor: "#FFFF00" }}
        _focus={{ borderColor: "#FFFF00", boxShadow: "0 0 5px #FFFF00" }}
        _placeholder={{ color: "#FFFF00", opacity: 0.7 }}
        w="300px"
        textAlign="center"
      >
        <option value="player">Player</option>
        <option value="spectator">Spectator</option>
      </Select>

      <Button
        onClick={() => {
          console.log("🧪 Join Room button clicked", {
            roomCode,
            playerName,
            socketId: socket.id,
          });
          handleJoinRoom();
        }}
        size="lg"
        w="200px"
        bg="transparent"
        color="#00FF00"
        border="2px solid #00FF00"
        boxShadow="0 0 15px #00FF00"
        _hover={{ bg: "rgba(0,255,0,0.1)", boxShadow: "0 0 20px #00FF00" }}
        isDisabled={
          !isSocketConnected ||
          !socketIdReady ||
          !playerName.trim() ||
          !roomCode.trim()
        }
      >
        JOIN ROOM
      </Button>
    </VStack>
  );
}
