import {
  VStack,
  Heading,
  Box,
  Text,
  Button,
} from "@chakra-ui/react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { socket } from "./socket";

export default function FinalResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { roomCode } = useParams();
  const scores: Record<string, number> = location.state?.scores || {};

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const topScore = sorted[0]?.[1] || 0;
  const winners = sorted
    .filter(([_, score]) => score === topScore)
    .map(([name]) => name);

  const handlePlayAgain = () => {
    socket.emit("restartGame", { roomCode });
    navigate(`/room/${roomCode}`);
  };

  const handleReturnToLobby = () => {
    navigate("/join");
  };

  return (
    <VStack spacing={6} p={8} bg="#1F1F2E" minH="100vh" color="white">
      <Heading size="xl" color="gold">
        🏆 Final Scores
      </Heading>

      <Text fontSize="md" color="gray.300">
        Room Code: {roomCode}
      </Text>

      <Box w="100%" maxW="400px">
        {sorted.map(([name, score], idx) => (
          <Box
            key={name}
            p={3}
            bg={score === topScore ? "#FFD700" : "#2C2C3E"}
            borderRadius="md"
            w="100%"
          >
            #{idx + 1}: {name} — {score} pts
          </Box>
        ))}
      </Box>

      <Text fontSize="lg" color="cyan.300">
        {winners.length === 1
          ? `🎉 Winner: ${winners[0]}`
          : `🎉 Tie! Winners: ${winners.join(", ")}`}
      </Text>

      <VStack spacing={4} mt={8}>
        <Button
          onClick={handlePlayAgain}
          bg="transparent"
          color="#00FF00"
          border="2px solid #00FF00"
          boxShadow="0 0 15px #00FF00"
          _hover={{ bg: "rgba(0,255,0,0.1)", boxShadow: "0 0 20px #00FF00" }}
          size="lg"
          w="200px"
        >
          PLAY AGAIN
        </Button>

        <Button
          onClick={handleReturnToLobby}
          bg="transparent"
          color="#FF00FF"
          border="2px solid #FF00FF"
          boxShadow="0 0 15px #FF00FF"
          _hover={{ bg: "rgba(255,0,255,0.1)", boxShadow: "0 0 20px #FF00FF" }}
          size="lg"
          w="200px"
        >
          RETURN TO LOBBY
        </Button>
      </VStack>
    </VStack>
  );
}
