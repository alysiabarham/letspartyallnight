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
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { socket } from "./socket";
import { useLocation } from 'react-router-dom';

const SortableItem = ({ id, index }: { id: string; index: number }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

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
    >
      #{index + 1}: {id}
    </Box>
  );
};

function JudgeRankingPage() {
  const { roomCode } = useParams();
  const location = useLocation();
  const playerName = location.state?.playerName || 'Unknown';
  const [allEntries, setAllEntries] = useState<string[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [dragDisabled, setDragDisabled] = useState(false);
  const toast = useToast();
  const sensors = useSensors(useSensor(PointerSensor));
  const [category, setCategory] = useState('');

  useEffect(() => {
  console.log("🧭 JudgeRankingPage mounted. Room code:", roomCode);
    socket.on('gameStarted', ({ category }) => {
        setCategory(category);
    });

    socket.on('roomState', ({ phase, judgeName, category }) => {
        console.log("🧠 Received roomState:", { phase, judgeName });
        if (category) {
            setCategory(category);
        }
        if (phase === 'ranking') {
            socket.emit('requestEntries', { roomCode });
        }
        });

  // ✅ Step 1: Join the backend room
  socket.emit('joinGameRoom', {
    roomCode,
    playerName
});

// 🧠 Re-request entries if judge refreshes mid-round
socket.emit('requestEntries', { roomCode });

  // ✅ Step 2: Listen for entries
  const handleSendAllEntries = ({ entries }: { entries: string[] }) => {
    console.log("📦 Judge received entries:", entries); // ✅ already exists!
    console.log("🟢 Entries received in JudgeRankingPage:", entries); // ✅ extra confirmation

    if (!entries || entries.length === 0) {
      console.log("❌ No entries received. Staying in loading state.");
      return;
    }

    const uniqueEntries = Array.from(new Set(entries));
    const autoPick = uniqueEntries.slice(0, 5);
    
    if (uniqueEntries.length < 5) {
        toast({
            title: 'Duplicate entries detected',
            description: 'The Judge cannot rank duplicates. Please refresh after players submit better responses.',
            status: 'error',
            duration: 6000,
            isClosable: true,
        });
        setSubmitted(false); // ✅ reset any stale state
        setAllEntries(uniqueEntries);
        setSelectedEntries(autoPick);
        setDragDisabled(false); // ✅ re-enable drag
        return;
     }
   
    setAllEntries(uniqueEntries);
    setSelectedEntries(autoPick);
  };

  socket.on('sendAllEntries', handleSendAllEntries);

  return () => {
    socket.off('sendAllEntries', handleSendAllEntries);
  };
}, [roomCode, playerName, toast]);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = selectedEntries.indexOf(active.id);
      const newIndex = selectedEntries.indexOf(over.id);
      setSelectedEntries((items) => arrayMove(items, oldIndex, newIndex));
    }
  };

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

  const handleSubmit = () => {
    if (new Set(selectedEntries).size < selectedEntries.length) {
  toast({
    title: 'Duplicate detected!',
    description: 'Re-rank with 5 unique entries to continue.',
    status: 'warning',
    duration: 5000,
    isClosable: true,
  });
  return;
}

const hasDuplicates = new Set(selectedEntries).size !== selectedEntries.length;
if (hasDuplicates) {
  toast({
    title: 'Duplicate entries detected!',
    description: 'Please re-select any repeated items. Drag-and-drop only works with unique entries.',
    status: 'warning',
    duration: 5000,
    isClosable: true
  });
  return;
}

    console.log("✅ Submitting final ranking to server:", selectedEntries);

    socket.emit('submitRanking', {
      roomCode,
      ranking: selectedEntries
    });

    setSubmitted(true);
    toast({
      title: 'Ranking submitted!',
      description: 'Waiting for guesses...',
      status: 'success',
      duration: 4000,
      isClosable: true
    });
  };

  return (
  <VStack spacing={6} p={8} bg="#0F3460" minH="100vh" color="white">
    <Heading size="lg" color="#FF00FF">Judge Mode: Choose & Rank Top 5</Heading>
    <Text fontSize="md" fontStyle="italic">
      Select 5 unique responses and drag to rank them.
    </Text>

    {/* 🧠 Optional: Show round category if available */}
    {category && (
      <Heading size="md" color="yellow.200">Round Topic: {category}</Heading>
    )}

    {/* 🌀 Waiting for player entries */}
    {allEntries.length === 0 ? (
      <Box textAlign="center" pt={10}>
        <Spinner size="lg" />
        <Text pt={4}>Waiting for entries from players...</Text>
      </Box>
    ) : (
      <>
        {/* 🔢 Dropdowns for choosing top 5 */}
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

        {/* 🪄 Drag-and-drop zone */}
        <Heading size="md" color="yellow.300" pt={6}>
          Drag to Set Final Order
        </Heading>

        {!dragDisabled && (
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

            {/* ✅ Submission states */}
            {!submitted && (
              <Button colorScheme="green" onClick={handleSubmit}>
                Submit Final Ranking
              </Button>
            )}
            {submitted && (
              <Text fontSize="md" color="green.300">
                Ranking submitted. Waiting for guesses...
              </Text>
            )}
          </Box>
        )}
      </>
    )}
  </VStack>
);
}

export default JudgeRankingPage;
