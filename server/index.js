const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Use CORS middleware
app.use(cors());

const io = new Server(server, {
    cors: {
        origin: ['http://localhost:3000'], // Allow your React app to connect
        methods: ['GET', 'POST']
    }
});

// Game Room State
const gameRooms = {}; // Stores active rooms and their states
// Example room structure:
/*
gameRooms = {
    'ROOMCODE': {
        players: {
            'socketId1': { id: 'socketId1', name: 'Player1', isHost: true, score: 0 },
            'socketId2': { id: 'socketId2', name: 'Player2', isHost: false, score: 0 }
        },
        hostId: 'socketId1',
        gameStatus: 'lobby', // 'lobby', 'in-game', 'ranking', 'guessing_phase', 'results'
        currentTopic: 'Things to do on a rainy day',
        submittedItems: [], // { id: 'uniqueId', text: 'item text', playerId: 'socketId' }
        itemsForRanking: [], // Subset of submittedItems for ranking
        rankingPlayerId: null, // Socket ID of the player currently ranking
        secretRanking: [], // Array of item IDs in ranked order by the ranking player
        playerGuesses: {}, // { playerId: [guessedItemId1, ...], ... } // NEW: Stores guesses
        guessCount: 0 // Number of players who have submitted guesses // NEW: Track guesses
    }
}
*/

// Helper function to generate unique IDs for items
const generateUniqueId = () => Math.random().toString(36).substring(2, 9);

// Topics for the game
const gameTopics = [
    "Things to do on a rainy day",
    "Best snacks for a movie night",
    "Worst places to take a first date",
    "Most annoying sounds",
    "Things that are overrated",
    "Things that are underrated",
    "Best superpower",
    "Worst things to say at a funeral",
    "Most important things for survival",
    "Things that smell good",
    "Things that taste bad",
    "Essential items for a desert island"
];

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Create Room
    socket.on('create_room', (data) => {
        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase(); // 4-char code
        const playerName = data.playerName || `Player ${Math.random().toString(36).substring(2, 5)}`;

        if (gameRooms[roomCode]) {
            socket.emit('join_error', { message: 'Room code already exists. Try again.' });
            return;
        }

        gameRooms[roomCode] = {
            players: {
                [socket.id]: { id: socket.id, name: playerName, isHost: true, score: 0 }
            },
            hostId: socket.id,
            gameStatus: 'lobby',
            currentTopic: gameTopics[Math.floor(Math.random() * gameTopics.length)],
            submittedItems: [],
            itemsForRanking: [],
            rankingPlayerId: null,
            secretRanking: [],
            playerGuesses: {}, // Initialize player guesses
            guessCount: 0 // Initialize guess count
        };

        socket.join(roomCode);
        socket.emit('room_created', {
            roomCode: roomCode,
            players: Object.values(gameRooms[roomCode].players),
            topic: gameRooms[roomCode].currentTopic
        });
        console.log(`Room ${roomCode} created by ${playerName} (${socket.id})`);
    });

    // Join Room
    socket.on('join_room', (data) => {
        const { roomCode, playerName } = data;
        const room = gameRooms[roomCode];

        if (!room) {
            socket.emit('join_error', { message: 'Room not found.' });
            return;
        }
        if (Object.keys(room.players).length >= 8) { // Max 8 players
            socket.emit('join_error', { message: 'Room is full.' });
            return;
        }

        // Add player to room
        room.players[socket.id] = { id: socket.id, name: playerName, isHost: false, score: 0 };
        socket.join(roomCode);

        // Emit to the joining player
        socket.emit('room_joined', {
            roomCode: roomCode,
            players: Object.values(room.players),
            hostId: room.hostId,
            gameStatus: room.gameStatus, // Send current game status to new player
            topic: room.currentTopic // Send current topic
        });

        // Emit to all other players in the room
        socket.to(roomCode).emit('player_joined', {
            newPlayerName: playerName,
            players: Object.values(room.players)
        });
        console.log(`${playerName} (${socket.id}) joined room ${roomCode}`);
    });

    // Start Game
    socket.on('start_game', () => {
        let roomCode = null;
        for (const code in gameRooms) {
            if (gameRooms[code].players[socket.id] && gameRooms[code].hostId === socket.id) {
                roomCode = code;
                break;
            }
        }

        if (!roomCode) {
            socket.emit('game_start_error', { message: 'You are not the host or not in a room.' });
            return;
        }

        const room = gameRooms[roomCode];
        if (Object.keys(room.players).length < 2) {
            socket.emit('game_start_error', { message: 'Need at least 2 players to start the game.' });
            return;
        }

        room.gameStatus = 'in-game'; // Set initial game status
        room.submittedItems = []; // Clear any previous submissions
        room.itemsForRanking = [];
        room.rankingPlayerId = null;
        room.secretRanking = [];
        room.playerGuesses = {}; // Reset for new round
        room.guessCount = 0; // Reset for new round

        // Randomly pick a topic for the round
        room.currentTopic = gameTopics[Math.floor(Math.random() * gameTopics.length)];

        io.to(roomCode).emit('game_started', {
            message: 'Game has started! Submit your items.',
            topic: room.currentTopic
        });
        console.log(`Game started in room ${roomCode} with topic: ${room.currentTopic}`);
    });

    // Submit Item
    socket.on('submit_item', (data) => {
        const { roomCode, item } = data;
        const room = gameRooms[roomCode];

        if (!room || room.gameStatus !== 'in-game') {
            socket.emit('submission_error', { message: 'Not in a valid game state to submit.' });
            return;
        }

        // Check if player already submitted
        const playerAlreadySubmitted = room.submittedItems.some(
            (submittedItem) => submittedItem.playerId === socket.id
        );

        if (playerAlreadySubmitted) {
            socket.emit('submission_error', { message: 'You have already submitted an item for this round.' });
            return;
        }

        // Add item with a unique ID
        room.submittedItems.push({
            id: generateUniqueId(), // Assign unique ID to the item
            text: item,
            playerId: socket.id,
            playerName: room.players[socket.id].name
        });
        socket.emit('item_submitted_confirmation');
        console.log(`Player ${room.players[socket.id].name} submitted item in room ${roomCode}: "${item}"`);

        // Check if all players have submitted their items
        if (room.submittedItems.length === Object.keys(room.players).length) {
            io.to(roomCode).emit('all_items_submitted');
            console.log(`All items submitted in room ${roomCode}. Total: ${room.submittedItems.length}`);

            // Transition to ranking phase
            room.gameStatus = 'ranking';

            // Select 5 random items for ranking (or fewer if less than 5 submitted)
            const itemsToPick = Math.min(5, room.submittedItems.length);
            room.itemsForRanking = [];
            const shuffledItems = [...room.submittedItems].sort(() => 0.5 - Math.random());
            for (let i = 0; i < itemsToPick; i++) {
                room.itemsForRanking.push(shuffledItems[i]);
            }

            // For now, the host is the ranking player.
            // Later, we'll implement rotation.
            room.rankingPlayerId = room.hostId;
            const rankingPlayerName = room.players[room.rankingPlayerId].name;

            io.to(roomCode).emit('start_ranking_phase', {
                itemsToRank: room.itemsForRanking,
                rankingPlayerId: room.rankingPlayerId,
                rankingPlayerName: rankingPlayerName
            });
            console.log(`Ranking phase started in room ${roomCode}. Ranking player: ${rankingPlayerName}`);
        }
    });

    // Handle submission of secret ranking by the ranking player
    socket.on('submit_secret_ranking', (data) => {
        const { roomCode, rankedItemIds } = data;
        if (roomCode && gameRooms[roomCode]) {
            const room = gameRooms[roomCode];

            // 1. Verify if the sender is the designated ranking player and game is in ranking phase
            if (socket.id === room.rankingPlayerId && room.gameStatus === 'ranking') {
                // 2. Validate the submitted ranking (e.g., contains correct number of items, all unique, etc.)
                // Basic validation: ensure the number of submitted IDs matches the items to rank
                if (rankedItemIds.length !== room.itemsForRanking.length) {
                    socket.emit('secret_ranking_error', { message: 'Invalid number of items in ranking.' });
                    return;
                }
                // More robust validation could check if all original item IDs are present and unique
                const originalItemIds = new Set(room.itemsForRanking.map(item => item.id));
                const submittedItemIdsSet = new Set(rankedItemIds);

                if (submittedItemIdsSet.size !== rankedItemIds.length || // Check for duplicates in submission
                    ![...submittedItemIdsSet].every(id => originalItemIds.has(id))) { // Check if all submitted IDs are from original items
                    socket.emit('secret_ranking_error', { message: 'Invalid items submitted in ranking.' });
                    return;
                }

                // 3. Store the secret ranking
                room.secretRanking = rankedItemIds; // Store the ordered IDs
                console.log(`Secret ranking submitted by ${room.players[socket.id].name} in room ${roomCode}:`, room.secretRanking);

                // 4. Update game status to 'guessing_phase' (new status)
                room.gameStatus = 'guessing_phase';

                // Initialize player guesses for this round
                room.playerGuesses = {}; // { playerId: [guessedItemId1, guessedItemId2, ...], ... }
                room.guessCount = 0; // Track how many players have guessed

                // 5. Emit confirmation to the ranking player
                socket.emit('secret_ranking_confirmed', { message: 'Your secret ranking has been saved!' });

                // 6. Emit event to all other players to start their guessing phase
                const playersToGuess = Object.values(room.players).filter(p => p.id !== socket.id);
                if (playersToGuess.length > 0) {
                    io.to(roomCode).emit('start_guessing_phase', {
                        message: `Time to guess ${room.players[socket.id].name}'s ranking!`,
                        itemsToGuess: room.itemsForRanking, // Send the original items for display
                        rankingPlayerName: room.players[socket.id].name
                    });
                } else {
                    // If no guessers (only ranking player left), move directly to results (or end round)
                    console.log(`Only ranking player left in room ${roomCode}. Ending round.`);
                    io.to(roomCode).emit('no_guessers_ending_round', { message: 'No other players to guess. Round ending.' });
                    room.gameStatus = 'results'; // Temporarily move to results
                }
            } else {
                socket.emit('secret_ranking_error', { message: 'You are not the designated ranking player or game is not in ranking phase.' });
            }
        } else {
            socket.emit('secret_ranking_error', { message: 'Room not found.' });
        }
    });

    // NEW: Handle submission of a guess by a guessing player
    socket.on('submit_guess', (data) => {
        const { roomCode, guessedItemIds } = data;
        const room = gameRooms[roomCode];

        if (!room || room.gameStatus !== 'guessing_phase') {
            socket.emit('guess_error', { message: 'Not in a valid game state to submit a guess.' });
            return;
        }

        // Ensure player is NOT the ranking player
        if (socket.id === room.rankingPlayerId) {
            socket.emit('guess_error', { message: 'You are the ranking player; you cannot submit a guess.' });
            return;
        }

        // Check if player has already submitted a guess
        if (room.playerGuesses[socket.id]) {
            socket.emit('guess_error', { message: 'You have already submitted your guess for this round.' });
            return;
        }

        // Validate the submitted guess (similar to secret ranking validation)
        if (guessedItemIds.length !== room.itemsForRanking.length) {
            socket.emit('guess_error', { message: 'Invalid number of items in your guess.' });
            return;
        }
        const originalItemIds = new Set(room.itemsForRanking.map(item => item.id));
        const submittedItemIdsSet = new Set(guessedItemIds);

        if (submittedItemIdsSet.size !== guessedItemIds.length ||
            ![...submittedItemIdsSet].every(id => originalItemIds.has(id))) {
            socket.emit('guess_error', { message: 'Invalid items submitted in your guess.' });
            return;
        }

        // Store the guess
        room.playerGuesses[socket.id] = guessedItemIds;
        room.guessCount++;
        socket.emit('guess_submitted_confirmation', { message: 'Your guess has been submitted! Waiting for others...' });
        console.log(`Player ${room.players[socket.id].name} submitted guess in room ${roomCode}. Guess count: ${room.guessCount}`);

        // Check if all eligible players have submitted their guesses
        const playersToGuess = Object.values(room.players).filter(p => p.id !== room.rankingPlayerId);
        if (room.guessCount === playersToGuess.length) {
            console.log(`All guesses submitted in room ${roomCode}. Proceeding to results.`);
            room.gameStatus = 'results';
            io.to(roomCode).emit('all_guesses_submitted', {
                message: 'All guesses are in! Revealing results...'
                // Later: include secret ranking, all guesses, and scores
            });
            // Implement score calculation and actual results display in the next step
        }
    });


    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        let roomCode = null;
        let playerName = 'Unknown';

        // Find which room the disconnected user was in
        for (const code in gameRooms) {
            if (gameRooms[code].players[socket.id]) {
                roomCode = code;
                playerName = gameRooms[code].players[socket.id].name;
                break;
            }
        }

        if (roomCode) {
            const room = gameRooms[roomCode];
            delete room.players[socket.id]; // Remove player

            // If the host disconnected
            if (room.hostId === socket.id) {
                const remainingPlayerIds = Object.keys(room.players);
                if (remainingPlayerIds.length > 0) {
                    const newHostId = remainingPlayerIds[0]; // Assign first remaining player as new host
                    room.hostId = newHostId;
                    room.players[newHostId].isHost = true;
                    console.log(`New host for room ${roomCode}: ${room.players[newHostId].name} (${newHostId})`);
                    io.to(roomCode).emit('new_host', { newHostId: newHostId });
                } else {
                    // No players left, delete room
                    delete gameRooms[roomCode];
                    console.log(`Room ${roomCode} deleted as all players left.`);
                }
            }

            // Emit updated player list and player left message to the room
            io.to(roomCode).emit('player_left', {
                leftPlayerId: socket.id,
                players: Object.values(room.players),
                newHostId: room.hostId // Send new host ID just in case
            });
            console.log(`${playerName} (${socket.id}) left room ${roomCode}.`);

            // Handle game state changes if ranking player leaves
            if (room.gameStatus === 'ranking' && room.rankingPlayerId === socket.id) {
                console.log(`Ranking player ${playerName} left room ${roomCode}. Ranking interrupted.`);
                room.gameStatus = 'in-game'; // Revert to item submission
                room.submittedItems = []; // Clear items
                room.itemsForRanking = [];
                room.rankingPlayerId = null;
                room.secretRanking = [];
                room.playerGuesses = {}; // Reset for interrupted round
                room.guessCount = 0; // Reset
                // Re-pick a topic for the new round
                room.currentTopic = gameTopics[Math.floor(Math.random() * gameTopics.length)];

                io.to(roomCode).emit('ranking_interrupted', {
                    message: `${playerName} left the room, interrupting the ranking. Starting a new item submission phase.`,
                    topic: room.currentTopic
                });
            }
            // If a guessing player leaves during guessing phase
            if (room.gameStatus === 'guessing_phase' && socket.id !== room.rankingPlayerId) {
                // If the player who left had already submitted a guess, decrement guessCount
                if (room.playerGuesses[socket.id]) {
                    room.guessCount--;
                }
                delete room.playerGuesses[socket.id]; // Remove their guess

                const playersToGuess = Object.values(room.players).filter(p => p.id !== room.rankingPlayerId);
                // Check if all *remaining* guessers have submitted
                if (room.guessCount === playersToGuess.length) {
                    console.log(`All remaining guesses submitted in room ${roomCode}. Proceeding to results.`);
                    room.gameStatus = 'results';
                    io.to(roomCode).emit('all_guesses_submitted', {
                        message: 'All remaining guesses are in! Revealing results...'
                    });
                }
            }
        }
    });

    // Handle chat messages (for testing/basic communication)
    socket.on('send_message', (data) => {
        const { message } = data;
        let roomCode = null;
        let playerName = 'Unknown';

        // Find which room the user is in
        for (const code in gameRooms) {
            if (gameRooms[code].players[socket.id]) {
                roomCode = code;
                playerName = gameRooms[code].players[socket.id].name;
                break;
            }
        }

        if (roomCode) {
            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            io.to(roomCode).emit('receive_message', {
                senderId: socket.id,
                senderName: playerName,
                message: message,
                timestamp: timestamp
            });
            console.log(`Message in room ${roomCode} from ${playerName}: ${message}`);
        } else {
            // If not in a room, send back only to sender
            socket.emit('receive_message', {
                senderId: 'Server',
                message: 'You are not in a room to chat.',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});