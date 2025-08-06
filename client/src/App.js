import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

// DND Kit Imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import './App.css'; // Assuming you have some basic CSS

// IMPORTANT: For mobile access, replace 'localhost' with your computer's local IP address (e.g., '192.168.1.100')
// For development on the same machine, 'localhost' is fine.
const socket = io('http://localhost:3001');

// Helper function to generate unique IDs (if items don't have them yet, for dnd-kit)
const generateUniqueId = () => Math.random().toString(36).substring(2, 9);

// SortableItem component for dnd-kit
function SortableItem({ item }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    userSelect: 'none',
    padding: '10px',
    margin: '0 0 8px 0',
    backgroundColor: '#fff',
    color: '#282c34',
    borderRadius: '4px',
    border: '1px solid #61dafb',
    display: 'flex',
    alignItems: 'center',
    cursor: 'grab', // Indicate it's draggable
    boxSizing: 'border-box', // Ensure padding/border don't add to total width
  };

  return (
    <li ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {item.text}
    </li>
  );
}


function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [inputRoomCode, setInputRoomCode] = useState(''); // For joining a room
  const [currentRoomCode, setCurrentRoomCode] = useState(null); // The room user is in
  const [playersInRoom, setPlayersInRoom] = useState([]); // List of players in current room
  const [isHost, setIsHost] = useState(false);
  const [gameStatus, setGameStatus] = useState('not-in-room'); // 'not-in-room', 'lobby', 'in-game', 'ranking', 'guessing_phase', 'results'
  const [lobbyMessage, setLobbyMessage] = useState(''); // Messages for lobby (e.g., error, info)

  // Game-specific states for "Rank the Topic"
  const [currentTopic, setCurrentTopic] = useState(''); // The current topic for the round
  const [itemSubmission, setItemSubmission] = useState(''); // For player's item input
  const [submissionConfirmed, setSubmissionConfirmed] = useState(false); // To prevent multiple submissions
  // Changed from itemsToRank to an object with {id: ..., text: ...} for DND Kit
  const [itemsToRank, setItemsToRank] = useState([]); // The 5 items to be ranked by rankingPlayer or guessed by others
  const [rankingPlayerId, setRankingPlayerId] = useState(null); // Who is ranking this round
  const [rankingPlayerName, setRankingPlayerName] = useState(''); // Name of player ranking this round
  const [secretRankingSubmitted, setSecretRankingSubmitted] = useState(false); // To prevent multiple secret rankings
  const [guessSubmitted, setGuessSubmitted] = useState(false); // NEW: To prevent multiple guess submissions by a guessing player

  // Chat states (kept for testing)
  const [message, setMessage] = useState('');
  const [receivedMessages, setReceivedMessages] = useState([]);

  // DND Kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );


  useEffect(() => {
    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to Socket.IO server!');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setCurrentRoomCode(null);
      setPlayersInRoom([]);
      setIsHost(false);
      setGameStatus('not-in-room');
      setLobbyMessage('');
      setCurrentTopic('');
      setItemSubmission('');
      setSubmissionConfirmed(false);
      setItemsToRank([]); // Clear items to rank
      setRankingPlayerId(null);
      setRankingPlayerName('');
      setSecretRankingSubmitted(false); // Reset
      setGuessSubmitted(false); // NEW: Reset guess submission state
      console.log('Disconnected from Socket.IO server.');
    });

    // Event: Room created successfully (received by host)
    socket.on('room_created', (data) => {
      setCurrentRoomCode(data.roomCode);
      setPlayersInRoom(data.players);
      setIsHost(true); // Creator is host
      setGameStatus('lobby');
      setCurrentTopic(data.topic); // Set the initial topic
      setLobbyMessage(`Room created! Share code: ${data.roomCode}`);
      console.log('Room created:', data);
    });

    // Event: Player successfully joined (received ONLY by the joining player)
    socket.on('room_joined', (data) => {
      setCurrentRoomCode(data.roomCode);
      setPlayersInRoom(data.players);
      setIsHost(data.hostId === socket.id); // Set host status based on ID
      setGameStatus(data.gameStatus); // Set game status (lobby or in-game)
      setCurrentTopic(data.topic); // Get the current topic
      setLobbyMessage(`Joined room: ${data.roomCode}`);
      console.log('Joined room:', data);
    });

    // Event: A player successfully joined the room (received by all in room EXCEPT the new player)
    socket.on('player_joined', (data) => {
      setPlayersInRoom(data.players);
      setLobbyMessage(`${data.newPlayerName} joined the room!`);
      console.log('Player joined:', data);
    });

    // Event: A player left the room (received by all in room)
    socket.on('player_left', (data) => {
        setPlayersInRoom(data.players);
        // Find the name of the player who left (using the data.leftPlayerId passed from server)
        const leftPlayer = playersInRoom.find(p => p.id === data.leftPlayerId);
        setLobbyMessage(`${leftPlayer ? leftPlayer.name : 'A player'} left the room.`);
        // Update host status if current player is new host
        if (data.newHostId === socket.id) {
            setIsHost(true);
            setLobbyMessage('You are now the host!');
        }
        console.log('Player left:', data);
    });

    // Event: New host assigned (if original host left)
    socket.on('new_host', (data) => {
        if (data.newHostId === socket.id) {
            setIsHost(true);
            setLobbyMessage('You are now the host!');
        }
        // Update player list to reflect new host status
        setPlayersInRoom(prevPlayers => prevPlayers.map(p => ({
            ...p,
            isHost: p.id === data.newHostId
        })));
    });


    // Event: Error during join attempt
    socket.on('join_error', (data) => {
      setLobbyMessage(`Error: ${data.message}`);
      console.error('Join error:', data.message);
    });

    // Event: Game started (received by all in room)
    socket.on('game_started', (data) => {
        setGameStatus('in-game'); // Transition to in-game state
        setLobbyMessage(data.message);
        setCurrentTopic(data.topic); // Ensure topic is set for all players
        setSubmissionConfirmed(false); // Reset submission status for new round
        setItemsToRank([]); // Clear previous items
        setRankingPlayerId(null);
        setRankingPlayerName('');
        setSecretRankingSubmitted(false); // Reset
        setGuessSubmitted(false); // NEW: Reset guess submission state
        console.log('Game started:', data);
    });

    // Event: Error starting game
    socket.on('game_start_error', (data) => {
        setLobbyMessage(`Game Start Error: ${data.message}`);
        console.error('Game start error:', data.message);
    });

    // Event: Confirmation of item submission
    socket.on('item_submitted_confirmation', () => {
        setSubmissionConfirmed(true);
        setLobbyMessage('Your item has been submitted! Waiting for others...');
        console.log('Item submitted confirmation received.');
    });

    // Event: All players have submitted items, move to ranking phase
    socket.on('all_items_submitted', (data) => {
        // We'll primarily use itemsToRank from 'start_ranking_phase'
        setLobbyMessage('All items submitted! Get ready to rank...');
        console.log('All items submitted. Server is preparing ranking phase...');
    });

    // Event: Start the ranking phase
    socket.on('start_ranking_phase', (data) => {
        setGameStatus('ranking'); // Change game status to ranking
        // Map items to ensure they have an 'id' property which dnd-kit requires
        const itemsWithIds = data.itemsToRank.map(item => ({ ...item, id: item.id || generateUniqueId() })); // Ensure ID
        setItemsToRank(itemsWithIds); // Set the 5 items to rank
        setRankingPlayerId(data.rankingPlayerId);
        setRankingPlayerName(data.rankingPlayerName);
        setSecretRankingSubmitted(false); // Reset for new ranking phase
        setGuessSubmitted(false); // NEW: Reset guess submission state
        setLobbyMessage(`${data.rankingPlayerName} is secretly ranking the items!`);
        console.log('Starting ranking phase:', data);
    });

    // Event: Submission error
    socket.on('submission_error', (data) => {
        setLobbyMessage(`Submission Error: ${data.message}`);
        console.error('Submission error:', data.message);
    });

    // Event: Ranking interrupted (e.g., ranking player left)
    socket.on('ranking_interrupted', (data) => {
        setGameStatus('in-game'); // Go back to submission phase
        setLobbyMessage(`Ranking interrupted: ${data.message}`);
        setSubmissionConfirmed(false); // Allow re-submission
        setItemsToRank([]); // Clear items
        setRankingPlayerId(null);
        setRankingPlayerName('');
        setSecretRankingSubmitted(false);
        setGuessSubmitted(false); // NEW: Reset guess submission state
        console.log('Ranking interrupted:', data);
    });

    // Event: Confirmation that secret ranking was received
    socket.on('secret_ranking_confirmed', (data) => {
        setSecretRankingSubmitted(true);
        setLobbyMessage('Your secret ranking has been submitted! Other players are now guessing.');
        console.log('Secret ranking confirmed:', data);
    });

    socket.on('secret_ranking_error', (data) => {
        setLobbyMessage(`Ranking Error: ${data.message}`);
        console.error('Secret ranking error:', data.message);
    });

    // Event: Start the guessing phase for non-ranking players
    socket.on('start_guessing_phase', (data) => {
        setGameStatus('guessing_phase'); // New status
        // Ensure itemsToRank is set correctly for guessing players (to reorder)
        const itemsWithIds = data.itemsToGuess.map(item => ({ ...item, id: item.id || generateUniqueId() })); // Ensure ID
        setItemsToRank(itemsWithIds);
        setRankingPlayerName(data.rankingPlayerName);
        setGuessSubmitted(false); // NEW: Crucial to reset this for guessing players
        setLobbyMessage(data.message);
        console.log('Starting guessing phase:', data);
    });

    socket.on('guess_submitted_confirmation', (data) => { // NEW: Confirmation for guess submission
      setGuessSubmitted(true);
      setLobbyMessage(data.message);
      console.log('Guess submitted confirmation:', data.message);
    });

    socket.on('guess_error', (data) => { // NEW: Error for guess submission
      setLobbyMessage(`Guess Error: ${data.message}`);
      console.error('Guess Error:', data.message);
    });

    socket.on('all_guesses_submitted', (data) => { // NEW: All guesses are in, time for results
        setGameStatus('results');
        setLobbyMessage(data.message);
        // You'll likely receive results data here eventually
        console.log('All guesses submitted, proceeding to results:', data);
    });

    socket.on('no_guessers_ending_round', (data) => {
        setGameStatus('results'); // Temporary
        setLobbyMessage(data.message);
        console.log('No guessers, ending round:', data);
    });


    // Keep existing message receive for testing purposes
    socket.on('receive_message', (data) => {
      setReceivedMessages((prevMessages) => [...prevMessages, data]);
    });


    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('player_joined');
      socket.off('player_left');
      socket.off('new_host');
      socket.off('join_error');
      socket.off('game_started');
      socket.off('game_start_error');
      socket.off('item_submitted_confirmation');
      socket.off('all_items_submitted');
      socket.off('start_ranking_phase');
      socket.off('submission_error');
      socket.off('ranking_interrupted');
      socket.off('secret_ranking_confirmed');
      socket.off('secret_ranking_error');
      socket.off('start_guessing_phase');
      socket.off('guess_submitted_confirmation'); // NEW
      socket.off('guess_error'); // NEW
      socket.off('all_guesses_submitted'); // NEW
      socket.off('no_guessers_ending_round');
      socket.off('receive_message');
    };
  }, [playersInRoom]); // Added playersInRoom as dependency to useEffect to update newHostId properly on player_left


  const handleCreateRoom = () => {
    if (playerName.trim() && isConnected) {
      socket.emit('create_room', { playerName: playerName.trim() });
      setLobbyMessage('Creating room...');
    } else {
      setLobbyMessage('Please enter your name.');
    }
  };

  const handleJoinRoom = () => {
    if (playerName.trim() && inputRoomCode.trim() && isConnected) {
      socket.emit('join_room', { roomCode: inputRoomCode.trim(), playerName: playerName.trim() });
      setLobbyMessage('Attempting to join room...');
    } else {
      setLobbyMessage('Please enter your name and the room code.');
    }
  };

  const handleStartGame = () => {
    if (isHost && currentRoomCode && isConnected) {
        socket.emit('start_game', {});
        setLobbyMessage('Starting game...');
    } else {
        setLobbyMessage('Only the host can start the game.');
    }
  };

  const handleSubmitItem = () => {
    if (itemSubmission.trim() && currentRoomCode && !submissionConfirmed && isConnected) {
        socket.emit('submit_item', {
            roomCode: currentRoomCode,
            item: itemSubmission.trim()
        });
        setItemSubmission(''); // Clear input
        setLobbyMessage('Submitting your item...');
    } else if (submissionConfirmed) {
        setLobbyMessage('You have already submitted an item for this round.');
    } else {
        setLobbyMessage('Please enter an item to submit.');
    }
  };

  // DND Kit Handler for the Ranking/Guessing Player
  function handleDragEnd(event) {
    const { active, over } = event;

    if (active.id !== over.id) {
      setItemsToRank((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newItems = Array.from(items);
        const [removed] = newItems.splice(oldIndex, 1);
        newItems.splice(newIndex, 0, removed);
        return newItems;
      });
    }
  }


  const handleSubmitSecretRanking = () => {
    if (currentRoomCode && socket.id === rankingPlayerId && !secretRankingSubmitted && isConnected) {
        // Send the ordered items' IDs to the backend
        const rankedItemIds = itemsToRank.map(item => item.id);
        socket.emit('submit_secret_ranking', {
            roomCode: currentRoomCode,
            rankedItemIds: rankedItemIds
        });
        setLobbyMessage('Submitting your secret ranking...');
        // setSecretRankingSubmitted(true); // Will be set on confirmation from server
    } else if (secretRankingSubmitted) {
        setLobbyMessage('You have already submitted your secret ranking.');
    } else {
        setLobbyMessage('You are not the ranking player or not in a valid state to submit.');
    }
  };

  // NEW: Handler for submitting a guess
  const handleSubmitGuess = () => {
    // Only allow submission if in guessing phase, not the ranking player, and haven't submitted yet
    if (currentRoomCode && socket.id !== rankingPlayerId && !guessSubmitted && isConnected) {
      const guessedItemIds = itemsToRank.map(item => item.id); // Get current order of items
      socket.emit('submit_guess', {
        roomCode: currentRoomCode,
        guessedItemIds: guessedItemIds
      });
      setLobbyMessage('Submitting your guess...');
      // setGuessSubmitted(true); // Will be set on confirmation from server
    } else if (guessSubmitted) {
      setLobbyMessage('You have already submitted your guess for this round.');
    } else {
      setLobbyMessage('You are the ranking player or not in a valid state to submit a guess.');
    }
  };


  // Keep existing sendMessage for testing
  const sendMessage = () => {
    if (message.trim()) {
      socket.emit('send_message', { message });
      setMessage('');
    }
  };


  // --- Render Logic ---
  if (!isConnected) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>Let's Party All Night!</h1>
          <p>Connecting to server...</p>
        </header>
      </div>
    );
  }

  if (gameStatus === 'not-in-room') {
    return (
      <div className="App">
        <header className="App-header">
          <h1>Let's Party All Night!</h1>
          <h2>Welcome!</h2>
          <p>Socket.IO Status: Connected</p>
          <div>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>
          <div style={{ marginTop: '20px' }}>
            <button onClick={handleCreateRoom} disabled={!playerName.trim()}>Create New Room</button>
          </div>
          <div style={{ marginTop: '20px' }}>
            <input
              type="text"
              value={inputRoomCode}
              onChange={(e) => setInputRoomCode(e.target.value)}
              placeholder="Enter Room Code"
            />
            <button onClick={handleJoinRoom} disabled={!playerName.trim() || !inputRoomCode.trim()}>Join Room</button>
          </div>
          {lobbyMessage && <p style={{ color: 'red' }}>{lobbyMessage}</p>}
        </header>
      </div>
    );
  }

  // Lobby view
  if (gameStatus === 'lobby') {
    return (
      <div className="App">
        <header className="App-header">
          <h1>Lobby: {currentRoomCode}</h1>
          {lobbyMessage && <p style={{ color: 'green' }}>{lobbyMessage}</p>}
          <h2>Players:</h2>
          <ul>
            {playersInRoom.map((player) => (
              <li key={player.id}> {/* Use player.id as key */}
                {player.name} {player.isHost ? '(Host)' : ''} {player.id === socket.id ? '(You)' : ''}
              </li>
            ))}
          </ul>
          {isHost && (
            <button onClick={handleStartGame} disabled={playersInRoom.length < 2}>
              Start Game ({playersInRoom.length} Players)
            </button>
          )}
           {!isHost && (
            <p>Waiting for the host to start the game...</p>
           )}

          <div style={{ marginTop: '20px', borderTop: '1px solid #ccc', paddingTop: '20px' }}>
            <h3>Chat (for testing Socket.IO):</h3>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
            />
            <button onClick={sendMessage}>Send Message</button>
            <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #eee', padding: '10px', marginTop: '10px' }}>
              {receivedMessages.length === 0 ? (
                <p>No chat messages yet.</p>
              ) : (
                <ul>
                  {receivedMessages.map((msg, index) => (
                    <li key={index} style={{ listStyleType: 'none', marginBottom: '5px' }}>
                      <strong>[{msg.senderId ? msg.senderId.substring(0, 4) : 'Server'}]:</strong> {msg.message} <small>({msg.timestamp})</small>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </header>
      </div>
    );
  }

  // In-game view (submission phase)
  if (gameStatus === 'in-game') {
      return (
          <div className="App">
              <header className="App-header">
                  <h1>Game: Rank the Topic!</h1>
                  <h2>Room: {currentRoomCode}</h2>
                  {lobbyMessage && <p style={{ color: 'green' }}>{lobbyMessage}</p>}

                  <div style={{ marginTop: '20px', border: '1px solid #eee', padding: '15px', borderRadius: '8px' }}>
                      <h3>Topic:</h3>
                      <p style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#61dafb' }}>{currentTopic}</p>
                      {!submissionConfirmed ? (
                          <>
                              <input
                                  type="text"
                                  value={itemSubmission}
                                  onChange={(e) => setItemSubmission(e.target.value)}
                                  placeholder="Enter your item here (e.g., 'Sleeping')"
                                  maxLength="50" // Limit submission length
                                  style={{ width: '80%', padding: '8px', margin: '10px 0' }}
                              />
                              <button onClick={handleSubmitItem}>Submit Item</button>
                          </>
                      ) : (
                          <p style={{ color: '#aaa' }}>Waiting for other players to submit...</p>
                      )}
                  </div>

                  <div style={{ marginTop: '20px', borderTop: '1px solid #ccc', paddingTop: '20px' }}>
                      <h3>Chat (for testing Socket.IO):</h3>
                      <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type a message..."
                      />
                      <button onClick={sendMessage}>Send Message</button>
                      <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #eee', padding: '10px', marginTop: '10px' }}>
                        {receivedMessages.length === 0 ? (
                          <p>No chat messages yet.</p>
                        ) : (
                          <ul>
                            {receivedMessages.map((msg, index) => (
                              <li key={index} style={{ listStyleType: 'none', marginBottom: '5px' }}>
                                <strong>[{msg.senderId ? msg.senderId.substring(0, 4) : 'Server'}]:</strong> {msg.message} <small>({msg.timestamp})</small>
                            </li>
                            ))}
                          </ul>
                        )}
                      </div>
                  </div>
              </header>
          </div>
      );
  }

  // In-game view (ranking phase)
  if (gameStatus === 'ranking') {
    const isThisPlayerRanking = socket.id === rankingPlayerId;
    return (
      <div className="App">
        <header className="App-header">
          <h1>Game: Rank the Topic!</h1>
          <h2>Room: {currentRoomCode}</h2>
          {lobbyMessage && <p style={{ color: 'green' }}>{lobbyMessage}</p>}

          <div style={{ marginTop: '20px', border: '1px solid #eee', padding: '15px', borderRadius: '8px' }}>
            <h3>Topic:</h3>
            <p style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#61dafb' }}>{currentTopic}</p>
          </div>

          <div style={{ marginTop: '30px', borderTop: '1px solid #ccc', paddingTop: '20px' }}>
            <h2>Items to Rank:</h2>
            {isThisPlayerRanking && !secretRankingSubmitted ? (
              <>
                <p>You are the **RANKING PLAYER**! Drag and drop to order these items from 1 (top) to {itemsToRank.length} (bottom):</p>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={itemsToRank.map(item => item.id)} // Provide IDs to SortableContext
                    strategy={verticalListSortingStrategy}
                  >
                    <ul style={{ listStyleType: 'none', padding: 0, margin: '0 auto', width: '80%', maxWidth: '400px' }}>
                      {itemsToRank.map((item, index) => (
                        <SortableItem key={item.id} item={item} />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
                <button onClick={handleSubmitSecretRanking} style={{ marginTop: '20px' }}>
                  Submit My Secret Ranking
                </button>
              </>
            ) : isThisPlayerRanking && secretRankingSubmitted ? (
                <p>You have submitted your secret ranking. Waiting for other players to submit their guesses...</p>
            ) : (
              <>
                <p><strong>{rankingPlayerName}</strong> is secretly ranking the items.</p>
                <p>Get ready to guess their order!</p>
                <ul>
                  {itemsToRank.map((item) => (
                    <li key={item.id} style={{ border: '1px dashed #ccc', padding: '5px', margin: '5px 0', backgroundColor: '#fff', color: '#282c34', borderRadius: '4px' }}>
                      {item.text}
                    </li>
                  ))}
                </ul>
                <p>Waiting for {rankingPlayerName} to finish ranking...</p>
              </>
            )}
          </div>

          <div style={{ marginTop: '20px', borderTop: '1px solid #ccc', paddingTop: '20px' }}>
            <h3>Chat (for testing Socket.IO):</h3>
            <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            />
            <button onClick={sendMessage}>Send Message</button>
            <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #eee', padding: '10px', marginTop: '10px' }}>
              {receivedMessages.length === 0 ? (
                <p>No chat messages yet.</p>
              ) : (
                <ul>
                  {receivedMessages.map((msg, index) => (
                    <li key={index} style={{ listStyleType: 'none', marginBottom: '5px' }}>
                      <strong>[{msg.senderId ? msg.senderId.substring(0, 4) : 'Server'}]:</strong> {msg.message} <small>({msg.timestamp})</small>
                  </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </header>
      </div>
    );
  }

  // In-game view (guessing phase)
  if (gameStatus === 'guessing_phase') {
    const isThisPlayerRanking = socket.id === rankingPlayerId; // Still true for the ranking player

    return (
      <div className="App">
        <header className="App-header">
          <h1>Game: Rank the Topic!</h1>
          <h2>Room: {currentRoomCode}</h2>
          {lobbyMessage && <p style={{ color: 'green' }}>{lobbyMessage}</p>}

          <div style={{ marginTop: '20px', border: '1px solid #eee', padding: '15px', borderRadius: '8px' }}>
            <h3>Topic:</h3>
            <p style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#61dafb' }}>{currentTopic}</p>
          </div>

          <div style={{ marginTop: '30px', borderTop: '1px solid #ccc', paddingTop: '20px' }}>
            <h2>Guess the Ranking!</h2>
            {isThisPlayerRanking ? (
                <p>You submitted your ranking. Waiting for other players to submit their guesses!</p>
            ) : (
                <>
                    <p><strong>{rankingPlayerName}</strong> has submitted their secret ranking.</p>
                    <p>Now, it's your turn to drag and drop these items into the order you think they picked!</p>
                    {/* DND for guessing players */}
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd} // Re-use the same drag end handler
                    >
                      <SortableContext
                        items={itemsToRank.map(item => item.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <ul style={{ listStyleType: 'none', padding: 0, margin: '0 auto', width: '80%', maxWidth: '400px' }}>
                          {itemsToRank.map((item, index) => (
                            <SortableItem key={item.id} item={item} />
                          ))}
                        </ul>
                      </SortableContext>
                    </DndContext>
                    <button
                      onClick={handleSubmitGuess}
                      disabled={guessSubmitted} // Disable if guess already submitted
                      style={{ marginTop: '20px' }}
                    >
                      {guessSubmitted ? 'Guess Submitted! Waiting...' : 'Submit My Guess'}
                    </button>
                </>
            )}
          </div>

          {/* Chat section (copy from other gameStatus blocks) */}
          <div style={{ marginTop: '20px', borderTop: '1px solid #ccc', paddingTop: '20px' }}>
            <h3>Chat (for testing Socket.IO):</h3>
            <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            />
            <button onClick={sendMessage}>Send Message</button>
            <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #eee', padding: '10px', marginTop: '10px' }}>
              {receivedMessages.length === 0 ? (
                <p>No chat messages yet.</p>
              ) : (
                <ul>
                  {receivedMessages.map((msg, index) => (
                    <li key={index} style={{ listStyleType: 'none', marginBottom: '5px' }}>
                      <strong>[{msg.senderId ? msg.senderId.substring(0, 4) : 'Server'}]:</strong> {msg.message} <small>({msg.timestamp})</small>
                  </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </header>
      </div>
    );
  }

  // Placeholder for Results phase (coming soon)
  if (gameStatus === 'results') {
    return (
        <div className="App">
            <header className="App-header">
                <h1>Game Results!</h1>
                <h2>Room: {currentRoomCode}</h2>
                <p>Results will be displayed here soon!</p>
                <button onClick={() => window.location.reload()}>Start New Game</button>
            </header>
        </div>
    );
  }

  return null; // Should not reach here
}

export default App;