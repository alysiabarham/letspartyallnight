import React, { useEffect } from "react";
import { useToast } from "@chakra-ui/react";
import {
  Routes,
  Route,
  Navigate,
  HashRouter as Router,
  useNavigate,
} from "react-router-dom";
import {
  ChakraProvider,
  Box,
  VStack,
  Text,
  Input,
  Button,
} from "@chakra-ui/react";
import axios from "axios";
import "./App.css";
import { socket } from "./socket";
import { AxiosError } from "axios";

// Pages
import Home from "./pages/Home";
import RoomPage from "./RoomPage";
import EnterRoom from "./pages/EnterRoom";
import JudgeRankingPage from "./JudgeRankingPage";
import GuesserRankingPage from "./GuesserRankingPage";
import ResultsPage from "./ResultsPage";
import FinalResultsPage from "./FinalResultsPage";

const backendUrl = import.meta.env.VITE_BACKEND_URL;
console.log("🧪 Backend URL:", backendUrl);
console.log("📢 App.tsx DEPLOYMENT VERSION: 2025-09-25-alysia-final-v7");

function LandingPageContent() {
  const toast = useToast();
  const [roomCodeInput, setRoomCodeInput] = React.useState("");
  const [playerNameInput, setPlayerNameInput] = React.useState("");
  const [isSocketConnected, setIsSocketConnected] = React.useState(
    socket.connected
  );
  const [socketIdReady, setSocketIdReady] = React.useState(
    socket.id !== undefined
  );
  const navigate = useNavigate();

  useEffect(() => {
    console.log("🧪 Initial socket status:", {
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

  const handlePlayerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, "");
    console.log("🧪 handlePlayerNameChange:", {
      value: e.target.value,
      cleaned,
    });
    setPlayerNameInput(cleaned);
  };

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRoomCodeInput(e.target.value.replace(/[^a-zA-Z0-9]/g, ""));
  };

  const handleCreateRoom = async () => {
    console.log("🧪 handleCreateRoom triggered", {
      playerNameInput,
      socketId: socket.id,
    });

    if (!playerNameInput.trim()) {
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
      console.log("🧹 Cleared localStorage");

      const hostId = socket.id;
      const hostName = playerNameInput.trim();
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
      console.log("📍 Set localStorage:", {
        roomCode,
        playerName: hostName,
        isHost: true,
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
      console.log("📡 Sent joinGameRoom:", { roomCode, playerName: hostName });

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
      roomCodeInput,
      playerNameInput,
      socketId: socket.id,
    });

    if (!roomCodeInput.trim() || !playerNameInput.trim()) {
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
      const playerId = playerNameInput.trim();
      const upperRoomCode = roomCodeInput.trim().toUpperCase();
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
      console.log("📡 Sent joinGameRoom:", {
        roomCode: room.code,
        playerName: playerId,
      });

      await joinPromise;

      localStorage.setItem("alreadyJoined", room.code);
      localStorage.setItem("playerName", playerId);
      localStorage.setItem("isHost", "false");

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
    <VStack spacing={8} p={8} minH="100vh" justifyContent="center" bg="#1A1A2E">
      <div className="no-chakra">
        <h1 className="neon-title debug-flicker">
          <span className="word-pink">
            L<span className="flicker-letter">e</span>t’s
          </span>{" "}
          <span className="word-blue">
            <span className="flicker-letter">P</span>arty
          </span>{" "}
          <span className="word-yellow">All</span>{" "}
          <span className="word-orange">
            Ni<span className="flicker-letter">g</span>h
            <span className="flicker-letter">t</span>!
          </span>
        </h1>
      </div>
      <Text fontSize="lg" color="white">
        Host or join a game with friends.
      </Text>
      <Text fontSize="xs" color="gray.500">
        Build: 2025-09-25-Alysia-Final-v7
      </Text>
      <Input
        placeholder="Enter Your Name"
        size="lg"
        value={playerNameInput}
        onChange={handlePlayerNameChange}
        w="300px"
        textAlign="center"
        color="#FFFF00"
        borderColor="#FFFF00"
        _focus={{ borderColor: "#FFFF00", boxShadow: "0 0 5px #FFFF00" }}
        _placeholder={{ color: "#FFFF00", opacity: 0.7 }}
        pattern="^[a-zA-Z0-9]*$"
        title="Letters and numbers only"
      />
      <Button
        bg="transparent"
        color="#FF00FF"
        border="2px solid #FF00FF"
        boxShadow="0 0 15px #FF00FF"
        _hover={{ bg: "rgba(255,0,255,0.1)", boxShadow: "0 0 20px #FF00FF" }}
        size="lg"
        onClick={() => {
          console.log("🧪 Create Room button clicked", {
            playerNameInput,
            socketId: socket.id,
          });
          handleCreateRoom();
        }}
        w="200px"
        isDisabled={
          !isSocketConnected || !socketIdReady || !playerNameInput.trim()
        }
      >
        CREATE NEW ROOM
      </Button>
      <Text fontSize="lg" color="white">
        OR
      </Text>
      <Input
        placeholder="Enter Room Code"
        size="lg"
        value={roomCodeInput}
        onChange={handleRoomCodeChange}
        w="300px"
        textAlign="center"
        color="#FFFF00"
        borderColor="#FFFF00"
        _focus={{ borderColor: "#FFFF00", boxShadow: "0 0 5px #FFFF00" }}
        _placeholder={{ color: "#FFFF00", opacity: 0.7 }}
        pattern="^[a-zA-Z0-9]*$"
        title="Alphanumeric only"
      />
      <Button
        bg="transparent"
        color="#00FF00"
        border="2px solid #00FF00"
        boxShadow="0 0 15px #00FF00"
        _hover={{ bg: "rgba(0,255,0,0.1)", boxShadow: "0 0 20px #00FF00" }}
        size="lg"
        onClick={handleJoinRoom}
        w="200px"
        isDisabled={!isSocketConnected || !socketIdReady}
      >
        JOIN ROOM
      </Button>
    </VStack>
  );
}

function App() {
  console.log("✅ App component mounted");
  useEffect(() => {
    document.body.classList.add("loaded");
    console.log("🧪 Socket status:", {
      connected: socket.connected,
      id: socket.id,
    });

    socket.onAny((event, payload) => {
      console.log(`📡 [Global] Received event: ${event}`, payload);
    });

    socket.on("sendAllEntries", ({ entries }) => {
      console.log("📦 [Global] Received sendAllEntries:", entries);
    });

    return () => {
      socket.offAny();
      socket.off("sendAllEntries");
    };
  }, []);

  return (
    <ChakraProvider>
      <Router>
        <Box minH="100vh">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/enter-room" element={<EnterRoom />} />
            <Route path="/join" element={<LandingPageContent />} />
            <Route path="/room/:roomCode" element={<RoomPage />} />
            <Route path="/judge/:roomCode" element={<JudgeRankingPage />} />
            <Route path="/guess/:roomCode" element={<GuesserRankingPage />} />
            <Route path="/results/:roomCode" element={<ResultsPage />} />
            <Route path="/final/:roomCode" element={<FinalResultsPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Box>
      </Router>
    </ChakraProvider>
  );
}

export default App;
