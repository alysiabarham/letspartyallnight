// src/GuesserRankingPage.tsx
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { VStack, Heading, Button, Box, Text, useToast, Spinner } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { socket } from "./socket";

const SortableItem = ({ id, index }: { id: string; index: number }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    boxShadow: "0 0 10px #00FFFF",
    color: "#00FFFF",
  };

  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      p={3}
      bg="#16213E"
      borderRadius="md"
      w="100%"
      _hover={{ boxShadow: "0 0 15px #00FFFF", transform: "scale(1.02)" }}
    >
      #{index + 1}: {id}
    </Box>
  );
};

function GuesserRankingPage() {
  const { roomCode } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const sensors = useSensors(useSensor(PointerSensor));

  const [playerName] = useState(
    location.state?.playerName || localStorage.getItem("playerName") || "Guest",
  );

  const [entries, setEntries] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [resultsVisible, setResultsVisible] = useState(false);
  const [category, setCategory] = useState("");
  const [finalRanking, setFinalRanking] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(5);

  useEffect(() => {
    if (!socket.connected) {
      toast({ title: "Socket not connected.", status: "error" });
    } else {
      socket.emit("joinGameRoom", { roomCode, playerName });
    }

    socket.on("roomState", ({ phase, category, currentRound, totalRounds, scores }) => {
      if (category) setCategory(category);
      if (currentRound) setCurrentRound(currentRound);
      if (totalRounds) setTotalRounds(totalRounds);
      if (scores) setScores(scores);
      if (phase === "ranking") socket.emit("requestEntries", { roomCode });
    });

    socket.on("sendAllEntries", ({ entries }: { entries: string[] }) => {
      if (!entries || entries.length < 1) return;
      const unique = Array.from(new Set(entries));
      setEntries(unique);
    });

    socket.on("revealResults", ({ judgeRanking, results, scores }) => {
      setFinalRanking(judgeRanking);
      setScore(results[playerName]?.score || 0);
      setScores(scores || {});
      setResultsVisible(true);
      toast({
        title: `Results revealed! You scored ${results[playerName]?.score || 0} points!`,
        description: "See how your guess compares to the Judge’s ranking.",
        status: "info",
        duration: 6000,
        isClosable: true,
      });
    });

    socket.on("gameOver", ({ scores }) => {
      navigate(`/final/${roomCode}`, { state: { scores } });
    });

    return () => {
      socket.off("roomState");
      socket.off("sendAllEntries");
      socket.off("revealResults");
      socket.off("gameOver");
    };
  }, [roomCode, playerName, toast, navigate]);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    const oldIndex = entries.indexOf(active.id);
    const newIndex = entries.indexOf(over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      setEntries((items) => arrayMove(items, oldIndex, newIndex));
    }
  };

  const handleSubmit = () => {
    socket.emit("submitGuess", { roomCode, playerName, guess: entries });
    setSubmitted(true);
    toast({
      title: "Guess submitted!",
      description: "Waiting for results...",
      status: "success",
      duration: 4000,
      isClosable: true,
    });
  };

  return (
    <VStack spacing={6} p={8} bg="#0c0655ff" minH="100vh" color="white">
      <Heading size="md" color="yellow.200">
        Round {currentRound} of {totalRounds}
      </Heading>

      {category && (
        <Heading size="md" color="cyan.300">
          Topic: {category}
        </Heading>
      )}

      {!resultsVisible ? (
        <>
          <Heading size="lg" color="#FFFF00">
            Your Guess: Rank the Entries
          </Heading>
          <Text fontSize="md" fontStyle="italic">
            Drag and drop the entries how you think the Judge ranked them.
          </Text>

          {entries.length < 1 ? (
            <Box pt={10} textAlign="center">
              <Spinner size="lg" />
              <Text pt={4}>Waiting for Judge’s selected entries...</Text>
            </Box>
          ) : (
            <Box w="100%" maxW="400px">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={entries} strategy={verticalListSortingStrategy}>
                  <VStack spacing={3}>
                    {entries.map((item, index) => (
                      <SortableItem key={item} id={item} index={index} />
                    ))}
                  </VStack>
                </SortableContext>
              </DndContext>
            </Box>
          )}

          {!submitted && entries.length > 0 && (
            <Button colorScheme="green" onClick={handleSubmit}>
              Submit Your Guess
            </Button>
          )}

          {submitted && (
            <Text fontSize="md" color="green.300">
              Ranking submitted. Waiting for results...
            </Text>
          )}
        </>
      ) : (
        <>
          <Heading size="lg" color="#FF00FF">
            Judge’s Final Ranking
          </Heading>
          <Box w="100%" maxW="400px">
            <VStack spacing={3}>
              {finalRanking.length === 0 ? (
                <Text color="gray.400">Waiting for Judge’s ranking...</Text>
              ) : (
                finalRanking.map((item, idx) => (
                  <Box key={item} p={3} bg="#1A1A2E" borderRadius="md" w="100%">
                    #{idx + 1}: {item}
                  </Box>
                ))
              )}
            </VStack>
          </Box>
          <Text pt={4} fontSize="lg" fontWeight="bold" color="yellow.400">
            Your Score This Round: {score}
          </Text>
          <Text fontSize="md" color="whiteAlpha.800">
            Total Score: {scores[playerName] || 0}
          </Text>
          <Button mt={4} colorScheme="blue" onClick={() => navigate("/")}>
            Back to Lobby
          </Button>
        </>
      )}
    </VStack>
  );
}

export default GuesserRankingPage;
