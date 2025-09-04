import React, { useEffect } from "react";
import { useToast } from "@chakra-ui/react";
import { Routes, Route, Navigate, HashRouter as Router, useNavigate } from "react-router-dom";
import { ChakraProvider, Box, VStack, Heading, Text, Input, Button } from "@chakra-ui/react";
import axios from "axios";
import "./App.css";
import { socket } from "./socket";

// Pages
import Home from "./pages/Home";
import RoomPage from "./RoomPage";
import EnterRoom from "./pages/EnterRoom";
import JudgeRankingPage from "./JudgeRankingPage";
import GuesserRankingPage from "./GuesserRankingPage";
import ResultsPage from "./ResultsPage";
import FinalResultsPage from "./FinalResultsPage";

const backendUrl = import.meta.env.VITE_BACKEND_URL;
console.log("Backend URL:", backendUrl);

function LandingPageContent() {
  const toast = useToast();
  const [roomCodeInput, setRoomCodeInput] = React.useState("");
  const [playerNameInput, setPlayerNameInput] = React.useState("");
  const [isSocketConnected, setIsSocketConnected] = React.useState(socket.connected);
  const navigate = useNavigate();

  useEffect(() => {
    socket.on("connect", () => {
      setIsSocketConnected(true);
      console.log("✅ Socket connected:", socket.id);
    });
    return () => {
      socket.off("connect");
    };
  }, []);

  const handlePlayerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlayerNameInput(e.target.value.replace(/[^a-zA-Z0-9]/g, ""));
  };

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRoomCodeInput(e.target.value.replace(/[^a-zA-Z0-9]/g, ""));
  };

  const handleCreateRoom = async () => {
    if (!playerNameInput.trim()) {
      toast({
        title: "Enter your name.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (!isSocketConnected) {
      toast({
        title: "Connecting to server...",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      const hostId = playerNameInput.trim();
      const response = await axios.post(`${backendUrl}/create-room`, {
        hostId,
      });
      const { roomCode } = response.data;

      // Set localStorage immediately for host
      localStorage.setItem("alreadyJoined", roomCode);
      localStorage.setItem("playerName", hostId);
      localStorage.setItem("isHost", "true");
      console.log("📍 Set localStorage for host:", { roomCode, playerName: hostId, isHost: true });

      // Wait for playerJoined confirmation
      const joinPromise = new Promise((resolve, reject) => {
        socket.once("playerJoined", ({ success, roomCode: joinedCode, playerName }) => {
          console.log("📡 Received playerJoined:", { success, roomCode: joinedCode, playerName });
          if (success && joinedCode === roomCode && playerName === hostId) {
            resolve(true);
          } else {
            reject(new Error("Failed to confirm join"));
          }
        });
        socket.once("joinError", ({ message }) => {
          console.log("📡 Received joinError during create:", message);
          reject(new Error(message));
        });
      });

      socket.emit("joinGameRoom", { roomCode, playerName: hostId });
      console.log("📡 Sent joinGameRoom for host:", { roomCode, playerName: hostId });

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

      navigate(`/room/${roomCode}`, { state: { playerName: hostId, isHost: true } });
      console.log("🚀 Navigated to room:", roomCode);
    } catch (error: any) {
      console.error("Create/Join error:", error.response?.data || error.message);
      localStorage.removeItem("alreadyJoined");
      localStorage.removeItem("playerName");
      localStorage.removeItem("isHost");
      toast({
        title: "Error creating room.",
        description: error.response?.data?.error || error.message || "Try again later.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCodeInput.trim() || !playerNameInput.trim()) {
      toast({
        title: "Enter name and code.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (!isSocketConnected) {
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
      const response = await axios.post(`${backendUrl}/join-room`, {
        roomCode: roomCodeInput,
        playerId,
        socketId: socket.id,
      });

      const { room } = response.data;

      // Wait for playerJoined confirmation
      const joinPromise = new Promise((resolve, reject) => {
        socket.once("playerJoined", ({ success, roomCode: joinedCode, playerName }) => {
          console.log("📡 Received playerJoined:", { success, roomCode: joinedCode, playerName });
          if (success && joinedCode === room.code && playerName === playerId) {
            resolve(true);
          } else {
            reject(new Error("Failed to confirm join"));
          }
        });
        socket.once("joinError", ({ message }) => {
          console.log("📡 Received joinError during join:", message);
          reject(new Error(message));
        });
      });

      socket.emit("joinGameRoom", { roomCode: room.code, playerName: playerId });
      console.log("📡 Sent joinGameRoom for join:", { roomCode: room.code, playerName: playerId });

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

      navigate(`/room/${room.code}`, { state: { playerName: playerId, isHost: false } });
      console.log("🚀 Navigated to room:", room.code);
    } catch (error: any) {
      console.error("Join error:", error.response?.data || error.message);
      toast({
        title: "Join failed.",
        description: error.response?.data?.error || error.message || "Room not found or full.",
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
            Ni<span className="flicker-letter">g</span>h<span className="flicker-letter">t</span>!
          </span>
        </h1>
      </div>
      <Text fontSize="lg" color="white">
        Host or join a game with friends.
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
        onClick={handleCreateRoom}
        w="200px"
        isDisabled={!isSocketConnected}
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
        isDisabled={!isSocketConnected}
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
