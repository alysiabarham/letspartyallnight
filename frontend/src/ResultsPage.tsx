// src/ResultsPage.tsx
import { useParams, useNavigate } from 'react-router-dom';
import { VStack, Heading, Text, Button } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { socket } from './socket';

function ResultsPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const score = localStorage.getItem('score');
  const [scores, setScores] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    socket.on('finalScores', (data: Record<string, number>) => {
      setScores(data);
    });

    return () => {
      socket.off('finalScores');
    };
  }, []);

  // 🧪 Optional: dummy scores for testing
  const dummyScores = {
    Alysia: 12,
    Jordan: 9,
    Max: 12,
    Sam: 7,
  };

  return (
    <VStack spacing={6} p={8} minH="100vh" bg="#1A1A2E" color="white" justify="center">
      <Heading size="xl" color="#FF00FF">Game Over</Heading>
      <Text fontSize="lg">Room Code: {roomCode}</Text>
      <Text fontSize="md" fontStyle="italic">Thanks for playing!</Text>

      {score && (
        <Text fontSize="lg" color="yellow.300">
          Your Final Score: {score}
        </Text>
      )}

      {/* ✅ Real scores button */}
      <Button
        colorScheme="green"
        onClick={() => {
          if (scores) {
            navigate(`/final/${roomCode}`, { state: { scores } });
          } else {
            alert('Scores not available yet.');
          }
        }}
      >
        View Final Results
      </Button>

      {/* 🧪 Optional: dummy scores button for testing */}
      <Button
        colorScheme="pink"
        onClick={() => navigate(`/final/${roomCode}`, { state: { scores: dummyScores } })}
      >
        View Dummy Results
      </Button>

      <Button colorScheme="green" onClick={() => navigate(`/room/${roomCode}`)}>
        Play Again
      </Button>

      <Button colorScheme="yellow" onClick={() => navigate('/')}>
        Back to Home
      </Button>
    </VStack>
  );
}

export default ResultsPage;
