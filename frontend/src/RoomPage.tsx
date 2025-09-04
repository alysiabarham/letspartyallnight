import { useState, useEffect, useRef } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import {
  HStack,
  VStack,
  Heading,
  Text,
  Input,
  Button,
  Box,
  List,
  ListItem,
  useToast,
} from "@chakra-ui/react";
import axios from "axios";
import { socket } from "./socket";

function RoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const playerName = location.state?.playerName || localStorage.getItem("playerName") || "Guest";
  const isHost = location.state?.isHost || localStorage.getItem("isHost") === "true";
  const [players, setPlayers] = useState<string[]>([]);
  const [entries, setEntries] = useState<string[]>([]);
  const [entryText, setEntryText] = useState("");
  const [doneSubmitting, setDoneSubmitting] = useState(false);
  const [host, setHost] = useState("");
  const [category, setCategory] = useState("");
  const [judge, setJudge] = useState("");
  const [round, setRound] = useState(1);
  const [gameStarted, setGameStarted] = useState(false);
  const [phase, setPhase] = useState<"lobby" | "entry" | "ranking" | "reveal">("lobby");
  const [roundLimit, setRoundLimit] = useState(5);
  const [role, setRole] = useState<"player" | "spectator">("player");
  const isInRoomRef = useRef(false);

  useEffect(() => {
    console.log("📍 RoomPage mounted:", {
      roomCode,
      playerName,
      isHost,
      localStorageIsHost: localStorage.getItem("isHost"),
    });
    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
      socket.emit("checkSocketId", { socketId: socket.id }); // Debug socket ID
    });
    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected");
    });
    return () => {
      socket.off("connect");
      socket.off("disconnect");
    };
  }, []);

  useEffect(() => {
    if (!roomCode) {
      console.warn("🚫 Missing room code");
      toast({ title: "Missing room code.", status: "error", duration: 3000 });
      navigate("/");
      return;
    }

    const safeName = playerName.trim().replace(/[^a-zA-Z0-9]/g, "");
    if (!safeName || safeName.length > 20) {
      console.warn("🚫 Invalid player name:", safeName);
      toast({
        title: "Name must be alphanumeric & under 20 chars.",
        status: "error",
        duration: 3000,
      });
      navigate("/");
      return;
    }

    const alreadyJoined = localStorage.getItem("alreadyJoined");
    const storedPlayerName = localStorage.getItem("playerName");
    const storedIsHost = localStorage.getItem("isHost") === "true";

    // Skip join attempt for hosts or already joined players
    if (isHost || storedIsHost || (alreadyJoined === roomCode && storedPlayerName === safeName)) {
      console.log("🛑 Host or already joined. Emitting setRole:", {
        isHost,
        storedIsHost,
        alreadyJoined,
        storedPlayerName,
        safeName,
      });
      isInRoomRef.current = true;
      socket.emit("setRole", { roomCode, playerName: safeName, role: "player" });
      return;
    }

    // Join logic for non-hosts
    const handleJoinRoom = async () => {
      if (!socket.connected) {
        console.warn("🛑 Socket not connected yet.");
        toast({
          title: "Connecting to server...",
          status: "warning",
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      console.log("📡 Sending joinGameRoom:", {
        roomCode,
        playerName: safeName,
        socketId: socket.id,
      });

      socket.emit("joinGameRoom", { roomCode, playerName: safeName });

      socket.once("playerJoined", ({ success, roomCode: joinedCode, playerName: joinedName }) => {
        console.log("📡 Received playerJoined:", {
          success,
          roomCode: joinedCode,
          playerName: joinedName,
        });
        if (success && joinedCode === roomCode && joinedName === safeName) {
          isInRoomRef.current = true;
          localStorage.setItem("alreadyJoined", roomCode);
          localStorage.setItem("playerName", safeName);
          localStorage.setItem("isHost", "false");
          if (!toast.isActive(`join-room-${roomCode}`)) {
            toast({
              id: `join-room-${roomCode}`,
              title: "Room joined!",
              description: `Joined: ${roomCode}`,
              status: "success",
              duration: 3000,
              isClosable: true,
            });
          }
        }
      });
    };

    const timer = setTimeout(() => {
      handleJoinRoom();
    }, 1000); // Delay to ensure socket connection

    return () => clearTimeout(timer);
  }, [roomCode, playerName, toast, navigate, isHost]);

  useEffect(() => {
    socket.on("joinError", ({ message }) => {
      console.log("📡 Received joinError:", {
        message,
        isInRoom: isInRoomRef.current,
        isHost,
        localStorageIsHost: localStorage.getItem("isHost"),
        players,
      });
      if (isInRoomRef.current || isHost || localStorage.getItem("isHost") === "true") {
        console.warn("⚠️ Ignoring joinError as player is already in room:", message);
        return;
      }
      toast({
        title: "Join failed",
        description: message,
        status: "error",
        duration: 3000,
      });
      setGameStarted(false);
      setPlayers([]);
      localStorage.removeItem("alreadyJoined");
      localStorage.removeItem("playerName");
      localStorage.removeItem("isHost");
      navigate("/");
    });

    socket.on("playerList", ({ players }) => {
      console.log("📡 Received playerList:", players);
      setPlayers(players);
      if (players.length > 0 && !host) {
        setHost(players[0]);
      }
    });

    socket.on("playerJoined", ({ players: playerList }) => {
      console.log("📡 Received playerJoined with players:", playerList);
      setPlayers(playerList.map((p: { id: string; name: string }) => p.name));
    });

    socket.on("gameStarted", ({ category, round }) => {
      console.log("🧠 New round started:", round);
      setRound(round);
      setGameStarted(true);
      setCategory(category);
      setDoneSubmitting(false);
      setPhase("entry");
      if (!toast.isActive("game-started")) {
        toast({
          id: "game-started",
          title: "Game Started!",
          status: "info",
          duration: 3000,
          isClosable: true,
        });
      }
    });

    socket.on("newEntry", ({ entry }) => {
      setEntries((prev) => [...prev, entry]);
    });

    socket.on("startRankingPhase", ({ judgeName }) => {
      console.log("🔔 Received startRankingPhase. Judge is:", judgeName, "I am:", playerName);
      setJudge(judgeName);
      setPhase("ranking");
      if (playerName === judgeName) {
        console.log("✅ I am the Judge. Navigating to /judge");
        navigate(`/judge/${roomCode}`, { state: { playerName } });
      } else {
        console.log("🕵️ I am a guesser. Navigating to /guess");
        navigate(`/guess/${roomCode}`, { state: { playerName } });
      }
    });

    socket.on("roomState", ({ players, phase, round, judgeName, category, state }) => {
      console.log("🩺 Resyncing from roomState:", { phase, judgeName, state, players });
      setPlayers(players.map((p: { name: string }) => p.name));
      setPhase(phase);
      setRound(round);
      setJudge(judgeName || "");
      setCategory(category || "");
      const me = (players as { name: string; role?: "player" | "spectator" }[]).find(
        (p) => p.name === playerName,
      );
      if (me?.role) {
        setRole(me.role);
      }
      isInRoomRef.current = players.some((p: { name: string }) => p.name === playerName);
      console.log("📍 Updated isInRoomRef:", isInRoomRef.current, "Player in players:", playerName);
    });

    socket.on("phaseChange", ({ phase }) => {
      setPhase(phase);
      if (phase === "ranking") {
        if (playerName === judge) {
          navigate(`/judge/${roomCode}`, { state: { playerName } });
        } else {
          navigate(`/guess/${roomCode}`, { state: { playerName } });
        }
      } else if (phase === "reveal") {
        navigate(`/results/${roomCode}`, { state: { playerName } });
      }
    });

    socket.on("toastWarning", ({ message }) => {
      if (!toast.isActive(`warning-${message}`)) {
        toast({
          id: `warning-${message}`,
          title: "Cannot advance yet",
          description: message,
          status: "warning",
          duration: 4000,
          isClosable: true,
        });
      }
    });

    return () => {
      socket.off("joinError");
      socket.off("playerList");
      socket.off("playerJoined");
      socket.off("gameStarted");
      socket.off("newEntry");
      socket.off("startRankingPhase");
      socket.off("roomState");
      socket.off("phaseChange");
      socket.off("toastWarning");
    };
  }, [playerName, navigate, roomCode, toast, judge]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const isJudge = playerName === judge;
      const hasEntries = entries.length >= 5;

      if (phase === "entry" && !isJudge && hasEntries) {
        if (!toast.isActive("waiting-judge")) {
          toast({
            id: "waiting-judge",
            title: "Waiting for judge to advance...",
            description: "Hang tight while the judge reviews entries.",
            status: "info",
            duration: 5000,
            isClosable: true,
          });
        }
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [phase, judge, playerName, entries]);

  const handleStartGame = () => {
    socket.emit("startGame", { roomCode, roundLimit });
    setGameStarted(true);
    if (!toast.isActive("game-started")) {
      toast({
        id: "game-started",
        title: "Game started!",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleEntrySubmit = (text: string) => {
    if (role !== "player") {
      toast({
        title: "Spectators can't submit entries",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const trimmed = text.trim();
    const cleaned = trimmed.toLowerCase();
    const isAlphanumeric = /^[a-zA-Z0-9 ]+$/.test(cleaned);
    if (!isAlphanumeric) {
      toast({
        title: "Invalid entry",
        description: "Please use only letters, numbers, and spaces—no punctuation or symbols.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
      return;
    }
    if (!trimmed) {
      toast({
        title: "Entry cannot be empty.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (entries.map((e) => e.toLowerCase()).includes(cleaned)) {
      toast({
        title: "Duplicate entry",
        description: "That response has already been submitted.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    socket.emit("submitEntry", { roomCode, playerName, entry: cleaned });
    setEntryText("");
    if (!toast.isActive(`submit-entry-${cleaned}`)) {
      toast({
        id: `submit-entry-${cleaned}`,
        title: "Entry submitted!",
        description: `"${trimmed}" added.`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleDoneSubmitting = () => {
    const uniqueEntryCount = new Set(entries.map((e) => e.toLowerCase())).size;
    if (uniqueEntryCount < 5) {
      toast({
        title: "Not enough unique responses",
        description:
          "There must be at least 5 unique entries in the room before you can mark yourself as done.",
        status: "warning",
        duration: 4000,
        isClosable: true,
      });
      return;
    }
    setDoneSubmitting(true);
    if (!toast.isActive("done-submitting")) {
      toast({
        id: "done-submitting",
        title: "Marked as done submitting.",
        status: "info",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleAdvanceToRankingPhase = () => {
    socket.emit("startRankingPhase", { roomCode, judgeName: judge });
  };

  const isJudge = playerName === judge;
  const isSpectator = role === "spectator";

  return (
    <VStack spacing={6} p={6} minH="100vh" bg="#0F0F1E" color="white" position="relative">
      <Heading size="2xl" className="neon-text">
        Room: <span style={{ color: "#FF00FF" }}>{roomCode}</span>
      </Heading>

      <Text fontSize="xl">Welcome, {playerName}!</Text>
      {host && <Text>Host: {host}</Text>}
      {judge && (
        <Text>
          Judge this round: <strong>{judge}</strong>
        </Text>
      )}

      {category && (
        <Box textAlign="center">
          <Heading size="2xl" fontFamily="Vivaldi">
            Rank the Topic
          </Heading>

          <Text fontSize="xl" fontFamily="ScreamingNeon" mt={2}>
            {category}
          </Text>

          <HStack justify="center" mt={1} spacing={4}>
            <Text fontSize="sm" color="gray.400">
              Phase: <strong>{phase}</strong>
            </Text>
            <Text fontSize="sm" color="gray.400">
              Round: <strong>{round}</strong> / {roundLimit}
            </Text>
          </HStack>
        </Box>
      )}

      <Text fontSize="sm" position="absolute" top="10px" right="10px" color="gray.400">
        Room: {roomCode}
      </Text>

      <Text fontSize="lg" color="white">
        Role: {role === "player" ? "🎮 Player" : "👀 Spectator"}
      </Text>

      {phase === "lobby" && isHost && (
        <>
          <Box>
            <Text fontSize="md" mt={4} color="#FFFF00">
              Number of Rounds:
            </Text>
            <Input
              type="number"
              value={roundLimit}
              onChange={(e) => setRoundLimit(Number(e.target.value))}
              min={1}
              max={10}
              w="100px"
              mt={1}
              borderColor="#FFFF00"
              color="#FFFF00"
              _placeholder={{ color: "#FFFF00", opacity: 0.6 }}
              _focus={{ borderColor: "#FFFF00", boxShadow: "0 0 5px #FFFF00" }}
            />
          </Box>
          <Button
            onClick={handleStartGame}
            size="lg"
            bg="transparent"
            color="#00FF00"
            border="2px solid #00FF00"
            boxShadow="0 0 15px #00FF00"
            _hover={{ bg: "rgba(0,255,0,0.1)", boxShadow: "0 0 20px #00FF00" }}
            isDisabled={players.length < 2}
          >
            START GAME
          </Button>
        </>
      )}

      {gameStarted && !isJudge && !isSpectator && !doneSubmitting && (
        <>
          <Input
            placeholder="Enter your ranked item"
            value={entryText}
            onChange={(e) => setEntryText(e.target.value)}
            size="lg"
            w="300px"
            textAlign="center"
            borderColor="#FFFF00"
            color="#FFFF00"
            _placeholder={{ opacity: 0.7, color: "#FFFF00" }}
            _focus={{ borderColor: "#FFFF00", boxShadow: "0 0 5px #FFFF00" }}
          />
          <Button
            onClick={() => handleEntrySubmit(entryText)}
            color="#00FF00"
            border="2px solid #00FF00"
            bg="transparent"
            _hover={{ bg: "rgba(0,255,0,0.1)", boxShadow: "0 0 15px #00FF00" }}
          >
            Submit Entry
          </Button>
          <Button
            onClick={handleDoneSubmitting}
            isDisabled={new Set(entries.map((e) => e.toLowerCase())).size < 5}
            colorScheme="blue"
          >
            I'm Done Submitting
          </Button>
        </>
      )}

      {gameStarted && !isJudge && !isSpectator && entries.length > 0 && (
        <Box mt={4} border="1px solid #FFFF00" p={3} borderRadius="md" w="300px">
          <Heading size="sm" mb={2} color="#FFFF00">
            Submitted Entries:
          </Heading>
          <List spacing={1}>
            {entries.map((entry, i) => (
              <ListItem key={i} color="whiteAlpha.800">
                • {entry}
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {gameStarted && isJudge && (
        <Button colorScheme="pink" onClick={handleAdvanceToRankingPhase}>
          Advance to Ranking Phase
        </Button>
      )}

      {gameStarted && isSpectator && (
        <Text mt={4} color="gray.300">
          You're spectating this round. Sit back and enjoy the chaos!
        </Text>
      )}

      <Box border="2px solid #00FFFF" p={4} borderRadius="md" w="300px" mt={6}>
        <Heading size="md" mb={2} color="#00FFFF">
          Players in Room:
        </Heading>
        {players.length === 0 ? (
          <Text>No players yet.</Text>
        ) : (
          players.map((p, i) => (
            <Text key={i} color="#FFFF00">
              {p}
            </Text>
          ))
        )}
      </Box>
    </VStack>
  );
}

export default RoomPage;
