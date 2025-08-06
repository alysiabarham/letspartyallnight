// src/ResultsPage.tsx
import { useParams } from 'react-router-dom';
import { VStack, Heading, Text, Button } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';

function ResultsPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const score = localStorage.getItem('score');

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
