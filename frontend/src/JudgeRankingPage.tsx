// src/JudgeRankingPage.tsx
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import {
  VStack,
  Heading,
  Button,
  Box,
  Text,
  Select,
  useToast,
  Spinner
} from '@chakra-ui/react';
import { AddIcon } from '@chakra-ui/icons';
import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { socket } from './socket';

const SortableItem = ({ id, index }: { id: string; index: number }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
  transform: CSS.Transform.toString(transform),
  transition,
  boxShadow: '0 0 10px #FF00FF',
  color: '#FF00FF',
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
  _hover={{ boxShadow: '0 0 15px #FF00FF', transform: 'scale(1.02)' }}
>
  #{index + 1}: {id}
</Box>
  );
};

function JudgeRankingPage() {
  const { roomCode } = useParams();
  const location = useLocation();
  const playerName = location.state?.playerName || 'Unknown';
  const [judgePhase, setJudgePhase] = useState<'select' | 'rank'>('select');
  const [allEntries, setAllEntries] = useState<string[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const toast = useToast();
  const sensors = useSensors(useSensor(PointerSensor));
  const [category, setCategory] = useState('');

  const hasDuplicates = new Set(selectedEntries).size !== selectedEntries.length;

 useEffect(() => {
  const handleSendAllEntries = ({ entries }: { entries: string[] }) => {
    const uniqueEntries = Array.from(new Set(entries));
    const autoPick = uniqueEntries.slice(0, 5);

    if (uniqueEntries.length < 5) {
      toast({
        title: 'Duplicate entries detected',
        description: 'Please refresh after players submit better responses.',
        status: 'error',
        duration: 6000,
        isClosable: true,
      });
      setSubmitted(false);
      setAllEntries(uniqueEntries);
      setSelectedEntries(autoPick);
      return;
    }

    setAllEntries(uniqueEntries);
    setSelectedEntries(autoPick);
  };

  if (socket.connected) {
    socket.on('sendAllEntries', handleSendAllEntries);
  } else {
    toast({ title: 'Socket not connected.', status: 'error' });
  }

  return () => {
    socket.off('sendAllEntries', handleSendAllEntries);
  };
}, [roomCode, playerName, toast]);

  const handleSwap = (index: number, newValue: string) => {
    const updated = [...selectedEntries];
    updated[index] = newValue;
    setSelectedEntries(updated);

    if (new Set(updated).size !== updated.length) {
      toast({
        title: 'Duplicate detected!',
        description: 'Try picking a different response.',
        status: 'error',
        duration: 4000,
        isClosable: true
      });
    }
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
if (!over) return;

const oldIndex = selectedEntries.indexOf(active.id);
const newIndex = selectedEntries.indexOf(over.id);
if (oldIndex !== -1 && newIndex !== -1) {
  setSelectedEntries((items) => arrayMove(items, oldIndex, newIndex));
}
};

  const handleSubmit = () => {
    if (hasDuplicates) {
      toast({
        title: 'Duplicate entries detected!',
        description: 'Please re-select any repeated items.',
        status: 'warning',
        duration: 5000,
        isClosable: true
      });
      return;
    }

    socket.emit('submitRanking', { roomCode, ranking: selectedEntries });
    setSubmitted(true);
    toast({
      title: 'Ranking submitted!',
      description: 'Waiting for guesses...',
      status: 'success',
      duration: 4000,
      isClosable: true
    });
  };

  const handleWatchAd = () => {
    // 🧪 Stub for future ad logic
    const remaining = allEntries.filter(e => !selectedEntries.includes(e));
    if (remaining.length === 0) {
      toast({
        title: 'No more entries available',
        description: 'All unique entries are already selected.',
        status: 'info',
        duration: 4000,
        isClosable: true
      });
      return;
    }

    const next = remaining[0];
    setSelectedEntries([...selectedEntries, next]);
    toast({
      title: 'Extra entry unlocked!',
      description: 'Thanks for watching the ad!',
      status: 'success',
      duration: 3000,
      isClosable: true
    });
  };

  return (
    <VStack spacing={6} p={8} bg="#0F3460" minH="100vh" color="white">
      <Heading size="lg" color="#FF00FF">Judge Mode: Choose & Rank Top 5</Heading>
      <Text fontSize="md" fontStyle="italic">
        Select 5 unique responses and drag to rank them.
      </Text>

      {category && (
        <Heading size="md" color="yellow.200">Round Topic: {category}</Heading>
      )}

      {allEntries.length === 0 ? (
        <Box textAlign="center" pt={10}>
          <Spinner size="lg" />
          <Text pt={4}>Waiting for entries from players...</Text>
        </Box>
      ) : (
        <>
          {judgePhase === 'select' && (
            <>
              {selectedEntries.map((entry, idx) => (
                <Box key={idx} w="100%" maxW="400px">
                  <Text color="gray.300">Slot #{idx + 1}</Text>
                  <Select
                    value={entry}
                    onChange={(e) => handleSwap(idx, e.target.value)}
                    bg="#16213E"
                    color="white"
                    borderColor="#FF00FF"
                  >
                    {allEntries.map((opt, i) => (
                      <option key={i} value={opt}>{opt}</option>
                    ))}
                  </Select>
                </Box>
              ))}

              <Button
                colorScheme="purple"
                onClick={() => setJudgePhase('rank')}
                isDisabled={selectedEntries.length < 5 || hasDuplicates}
              >
                Lock Selections
              </Button>

              <Button
                leftIcon={<AddIcon />}
                colorScheme="pink"
                onClick={handleWatchAd}
                isDisabled={selectedEntries.length >= allEntries.length}
              >
                Add Extra Entry (Watch Ad)
              </Button>
            </>
          )}

          {judgePhase === 'rank' && (
  <>
    <Heading size="md" color="yellow.300" pt={6}>
      Drag to Set Final Order
    </Heading>

    {selectedEntries.length === 0 ? (
      <Text color="gray.400">No entries selected yet.</Text>
    ) : (
      <Box w="100%" maxW="400px">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={selectedEntries} strategy={verticalListSortingStrategy}>
            <VStack spacing={3}>
              {selectedEntries.map((item, index) => (
                <SortableItem key={item} id={item} index={index} />
              ))}
            </VStack>
          </SortableContext>
        </DndContext>

        {!submitted ? (
          <Button colorScheme="green" onClick={handleSubmit}>
            Submit Final Ranking
          </Button>
        ) : (
          <>
            <Text fontSize="md" color="green.300">
              Ranking submitted. Waiting for guesses...
            </Text>
            <Button mt={4} colorScheme="blue" onClick={() => window.location.href = '/'}>
              Back to Lobby
            </Button>
          </>
        )}
      </Box>
    )}
  </>
)}
        </>
      )}
    </VStack>
  );
}

export default JudgeRankingPage;
