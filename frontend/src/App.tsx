// src/App.tsx
import { useEffect, useState } from "react";
import {
  Routes,
  Route,
  useNavigate,
  Navigate,
} from "react-router-dom";
import {
  Button,
  Input,
  VStack,
  Heading,
  Text,
  useToast,
  ChakraProvider,
  Box,
} from "@chakra-ui/react";
import axios from "axios";
import "./App.css";

import RoomPage from "./RoomPage";
import JudgeRankingPage from "./JudgeRankingPage";
import GuesserRankingPage from "./GuesserRankingPage";
import ResultsPage from "./ResultsPage";
import { socket } from "./socket";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

function LandingPageContent() {
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [playerNameInput, setPlayerNameInput] = useState("");
  const toast = useToast();
  const navigate = useNavigate();

  const handlePlayerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const filteredValue = e.target.value.replace(/[^a-zA-Z0-9]/g, "");
    setPlayerNameInput(filteredValue);
  };

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const filteredValue = e.target.value.replace(/[^a-zA-Z0-9]/g, "");
    setRoomCodeInput(filteredValue);
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

    try {
      const hostId = playerNameInput.trim();
      const response = await axios.post(`${backendUrl}/create-room`, {
        hostId,
      });
      const { roomCode } = response.data;

      toast({
        title: "Room created!",
        description: `Code: ${roomCode}`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      socket.emit("joinGameRoom", { roomCode, playerName: hostId });
      navigate(`/room/${roomCode}`, { state: { playerName: hostId } });
    } catch (error: any) {
      console.error("Create error:", error.response?.data || error.message);
      toast({
        title: "Error creating room.",
        description: error.response?.data?.error || "Try again later.",
        status: "error",
        duration: 5000,
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

    try {
      const playerId = playerNameInput.trim();
      const response = await axios.post(`${backendUrl}/join-room`, {
        roomCode: roomCodeInput,
        playerId,
      });

      const { room } = response.data;
      toast({
        title: "Room joined!",
        description: `Joined: ${room.code}`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      socket.emit("joinGameRoom", {
        roomCode: room.code,
        playerName: playerId,
      });
      navigate(`/room/${room.code}`, { state: { playerName: playerId } });
    } catch (error: any) {
      console.error("Join error:", error.response?.data || error.message);
      toast({
        title: "Join failed.",
        description:
          error.response?.data?.error || "Room not found or full.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <VStack spacing={8} p={8} minH="100vh" justifyContent="center" bg="#1A1A2E">
      <Heading
        as="h1"
        size="2xl"
        color="#FF00FF"
        textShadow="0 0 5px #FF00FF, 0 0 15px #FF00FF"
      >
        Let's Party All Night!
      </Heading>
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
      >
        JOIN ROOM
      </Button>
    </VStack>
  );
}

function App() {
  useEffect(() => {
    socket.onAny((event, payload) => {
      console.log(`📡 [Global] Received event: ${event}`, payload);
    });

    return () => {
      socket.offAny();
    };
  }, []);

  useEffect(() => {
    socket.on("sendAllEntries", ({ entries }) => {
      console.log("📦 [Global] Received sendAllEntries:", entries);
    });

    return () => {
      socket.off("sendAllEntries");
    };
  }, []);

  return (
    <ChakraProvider>
      <Box minH="100vh">
        <Routes>
          <Route path="/" element={<LandingPageContent />} />
          <Route path="/room/:roomCode" element={<RoomPage />} />
          <Route path="/judge/:roomCode" element={<JudgeRankingPage />} />
          <Route path="/guess/:roomCode" element={<GuesserRankingPage />} />
          <Route path="/results/:roomCode" element={<ResultsPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Box>
    </ChakraProvider>
  );
}

export default App;
