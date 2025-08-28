import { useState, useEffect } from "react";
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
import axios, { AxiosError } from "axios";
import { socket } from "./socket";

socket.on("connect", () => {
  console.log("✅ Socket connected:", socket.id);
});

function RoomPage() {
  const { roomCode } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const playerName = location.state?.playerName || "Guest";

  const [players, setPlayers] = useState<string[]>([]);
  const [entries, setEntries] = useState<string[]>([]);
  const [entryText, setEntryText] = useState("");
  const [doneSubmitting, setDoneSubmitting] = useState(false);
  const [host, setHost] = useState("");
  const [category, setCategory] = useState("");
  const [judge, setJudge] = useState("");
  const [round, setRound] = useState(1);
  const [gameStarted, setGameStarted] = useState(false);
  const [phase, setPhase] = useState<"waiting" | "entry" | "ranking">("waiting");
  const [roundLimit, setRoundLimit] = useState(5);
  const [role, setRole] = useState<"player" | "spectator">("player");

  localStorage.setItem("role", role);

  useEffect(() => {
    window.addEventListener("beforeunload", () => {
      localStorage.removeItem("alreadyJoined");
    });
  }, []);

  useEffect(() => {
    const storedRole = localStorage.getItem("role");
    if (storedRole === "player" || storedRole === "spectator") {
      setRole(storedRole);
    }

    socket.on("playerList", ({ players }) => {
      setPlayers(players); // or whatever your state setter is Salt said hi
    });

    return () => {
      socket.off("playerList");
    };
  }, []);

  useEffect(() => {
    if (!roomCode) {
      toast({ title: "Missing room code.", status: "error" });
      navigate("/");
      return;
    }

    const alreadyJoined = localStorage.getItem("alreadyJoined");
    if (alreadyJoined === roomCode) {
      console.log("🛑 Already joined this room. Skipping join.");
      return;
    }

    const handleJoinRoom = async () => {
      const safeName = playerName.trim().replace(/[^a-zA-Z0-9]/g, "");
      if (!safeName || safeName.length > 20) {
        toast({ title: "Name must be alphanumeric & under 20 chars.", status: "error" });
        return;
      }
      if (!socket?.id || !safeName || !roomCode) {
        console.warn("Missing required fields:", { socketId: socket?.id, safeName, roomCode });
        return;
      }

      try {
        console.log("JOINING ROOM:", { roomCode, safeName, socketId: socket.id });
        const response = await axios.post(
          "https://letspartyallnight-backend.onrender.com/join-room",
          {
            roomCode,
            playerId: safeName,
            socketId: socket.id,
          },
        );

        if (response.status === 200 || response.status === 201) {
          localStorage.setItem("alreadyJoined", roomCode);
          toast({ title: "Room joined!", status: "success" });
          setPhase("waiting");

          if (!socket.connected) {
            toast({ title: "Socket not ready yet.", status: "error" });
            return;
          }

          socket.emit("joinGameRoom", { roomCode, playerName: safeName });
          localStorage.setItem("playerName", playerName);
        } else {
          toast({ title: "Join failed", description: "Unexpected status code.", status: "error" });
        }
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          const axiosError = error as AxiosError;
          if (axiosError.response?.status === 409) {
          } else {
            toast({ title: "Join failed", description: axiosError.message, status: "error" });
          }
        } else {
          toast({
            title: "Join failed",
            description: "An unknown error occurred.",
            status: "error",
          });
        }
      }
    };

    handleJoinRoom();

    return () => {
      socket.off("playerJoined");
      socket.off("gameStarted");
      socket.off("newEntry");
      socket.off("startRankingPhase");
    };
  }, [roomCode, playerName, toast, navigate]);

  useEffect(() => {
    if (players.length > 0 && !host) {
      setHost(players[0]);
    }
  }, [players, host]);

  useEffect(() => {
    socket.on(
      "playerJoined",
      ({ players: playerList }: { players: { id: string; name: string }[] }) => {
        setPlayers(playerList.map((p) => p.name));
      },
    );

    socket.on("roomPlayers", ({ playerList }: { playerList: string[] }) => {
      setPlayers(playerList);
    });

    socket.on("gameStarted", ({ category, round }) => {
      console.log("🧠 New round started:", round);
      setRound(round);
      setGameStarted(true);
      setCategory(category);
      setDoneSubmitting(false);
      setPhase("entry");
      navigate(`/room/${roomCode}`, { state: { playerName } });
      console.log("Navigating to /entry:", roomCode);
      toast({
        title: "Game Started!",
        status: "info",
        duration: 3000,
        isClosable: true,
      });
    });

    socket.on("newEntry", ({ entry }) => {
      socket.on("startRankingPhase", ({ judgeName }) => {
        if (playerName === judgeName) {
          navigate(`/judge/${roomCode}`, { state: { playerName } });
        } else {
          navigate(`/guess/${roomCode}`, { state: { playerName } });
        }
      });
      setEntries((prev) => [...prev, entry]);
    });

    socket.on("startRankingPhase", ({ judgeName }) => {
      console.log("🔔 Received startRankingPhase. Judge is:", judgeName, "I am:", playerName);
      if (playerName === judgeName) {
        console.log("✅ I am the Judge. Navigating to /judge");
        navigate(`/judge/${roomCode}`, { state: { playerName } });
      } else {
        console.log("🕵️ I am a guesser. Navigating to /guess");
        navigate(`/guess/${roomCode}`, { state: { playerName } });
      }
    });

    socket.on("roomState", ({ players, phase, round, judgeName, category }) => {
      const me = (players as { name: string; role?: "player" | "spectator" }[]).find(
        (p) => p.name === playerName,
      );
      if (!toast.isActive("room-joined")) {
        toast({
          id: "room-joined",
          title: "Room joined!",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      }
      if (me?.role) {
        setRole(me.role);
        toast({
          title: `You're a ${me.role}`,
          status: me.role === "player" ? "success" : "info",
        });
      }
      setCategory(category);
      console.log("🩺 Resyncing from roomState:", { phase, judgeName });
      if (phase === "ranking") {
        if (playerName === judgeName) {
          navigate(`/judge/${roomCode}`, { state: { playerName } });
        } else {
          navigate(`/guess/${roomCode}`, { state: { playerName } });
        }
      }
    });

    socket.on("phaseChange", ({ phase }) => {
      socket.on("toastWarning", ({ message }) => {
        toast({
          title: "Cannot advance yet",
          description: message,
          status: "warning",
          duration: 4000,
          isClosable: true,
        });
      });
      setPhase(phase);
      if (phase === "entry") {
        navigate(`/entry/${roomCode}`, { state: { playerName } });
      } else if (phase === "ranking") {
        navigate(`/judge/${roomCode}`, { state: { playerName } });
      } else if (phase === "reveal") {
        navigate(`/reveal/${roomCode}`, { state: { playerName } });
      }
    });

    return () => {
      socket.off("playerJoined");
      socket.off("roomPlayers");
      socket.off("gameStarted");
      socket.off("newEntry");
      socket.off("startRankingPhase");
      socket.off("roomState");
      socket.off("toastWarning");
    };
  }, [playerName, navigate, roomCode, toast]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const isJudge = playerName === judge;
      const hasEntries = entries.length >= 5;

      if (phase === "entry" && !isJudge && hasEntries) {
        toast({
          title: "Waiting for judge to advance...",
          description: "Hang tight while the judge reviews entries.",
          status: "info",
          duration: 5000,
          isClosable: true,
        });
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [phase, judge, playerName, entries]);

  useEffect(() => {
    if (players.length > 0 && gameStarted) {
      const newJudgeIndex = (round - 1) % players.length;
      setJudge(players[newJudgeIndex]);
    }
  }, [players, round, gameStarted]);

  const handleStartGame = () => {
    socket.emit("startGame", { roomCode });
    toast({ title: "Game started!", status: "success", duration: 3000, isClosable: true });
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

    const trimmed = entryText.trim();
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
    toast({
      title: "Entry submitted!",
      description: `"${trimmed}" added.`,
      status: "success",
      duration: 3000,
      isClosable: true,
    });
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
      return; // prevent marking as done
    }
    setDoneSubmitting(true);
    toast({
      title: "Marked as done submitting.",
      status: "info",
      duration: 3000,
      isClosable: true,
    });
  };

  const handleAdvanceToRankingPhase = () => {
    socket.emit("startRankingPhase", { roomCode, judgeName: judge });
  };

  useEffect(() => {
    console.log(`🔁 Frontend advanced to round ${round}`);
  }, [round]);

  const isJudge = playerName === judge;
  const isHost = playerName === host;
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

      {!gameStarted && isHost && (
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
            onClick={() => {
              handleStartGame();
              setGameStarted(true);
            }}
            size="lg"
            bg="transparent"
            color="#00FF00"
            border="2px solid #00FF00"
            boxShadow="0 0 15px #00FF00"
            _hover={{ bg: "rgba(0,255,0,0.1)", boxShadow: "0 0 20px #00FF00" }}
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
