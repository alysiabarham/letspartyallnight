// src/pages/EnterRoom.tsx
import React, { useState } from "react";
import {
  VStack,
  Heading,
  Text,
  Input,
  Button,
  useToast,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { socket } from "../socket";
import { Select } from "@chakra-ui/react";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

export default function EnterRoom() {
  const [role, setRole] = useState("player");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const toast = useToast();
  const navigate = useNavigate();

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlayerName(e.target.value.replace(/[^a-zA-Z0-9]/g, ""));
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRoomCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ""));
  };

  const handleCreateRoom = async () => {
    console.log("Creating room with name:", playerName);
    if (!playerName.trim()) {
      toast({
        title: "Enter your name.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
if (!socket.connected) {
  toast({ title: "Socket not connected", status: "error" });
  return;
}
    try {
      const response = await axios.post(`${backendUrl}/create-room`, {
        hostId: playerName.trim(),
      });

      console.log("Create response:", response.data);
      const { roomCode } = response.data;

      toast({
        title: "Room created!",
        description: `Code: ${roomCode}`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });

      socket.emit("joinGameRoom", {
        roomCode,
        playerName: playerName.trim(),
      });

      navigate(`/room/${roomCode}`, {
        state: { playerName: playerName.trim() },
      });
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
    if (!playerName.trim() || !roomCode.trim()) {
      toast({
        title: "Enter name and code.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      const response = await axios.post(`${backendUrl}/join-room`, {
        roomCode: roomCode.trim(),
        playerId: playerName.trim(),
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
        playerName: playerName.trim(),
      });

      navigate(`/room/${room.code}`, {
        state: { playerName: playerName.trim() },
      });
    } catch (error: any) {
      console.error("Join error:", error.response?.data || error.message);
      toast({
        title: "Join failed.",
        description: error.response?.data?.error || "Room not found or full.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <VStack spacing={8} p={8} minH="100vh" justifyContent="center" bg="#0F0F1E">
      <Heading size="3xl" className="rank-title" style={{ fontFamily: 'Vivaldi' }}>
  Rank the Topic
</Heading>
      <Text fontSize="2xl" className="sub-heading" style={{ fontFamily: 'ScreamingNeon' }}>
  Enter the Party Zone 🎉
</Text>
      <Text className="sub-heading" color="white">Room: {roomCode}</Text>

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
        onClick={handleCreateRoom}
        size="lg"
        w="200px"
        bg="transparent"
        color="#FF00FF"
        border="2px solid #FF00FF"
        boxShadow="0 0 15px #FF00FF"
        _hover={{ bg: "rgba(255,0,255,0.1)", boxShadow: "0 0 20px #FF00FF" }}
      >
        CREATE ROOM
      </Button>

      <Text fontSize="lg" color="white">OR</Text>

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
      
<Select placeholder="Choose role" onChange={(e) => setRole(e.target.value)}>
  <option value="player">Player</option>
  <option value="spectator">Spectator</option>
</Select>

      <Button
        onClick={handleJoinRoom}
        size="lg"
        w="200px"
        bg="transparent"
        color="#00FF00"
        border="2px solid #00FF00"
        boxShadow="0 0 15px #00FF00"
        _hover={{ bg: "rgba(0,255,0,0.1)", boxShadow: "0 0 20px #00FF00" }}
      >
        JOIN ROOM
      </Button>
    </VStack>
  );
}
