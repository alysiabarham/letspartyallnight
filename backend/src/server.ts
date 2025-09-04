import express from "express";
import type { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { Room, PlayerResult, SubmitGuessPayload, RankingPayload } from "./types";
import { Server } from "socket.io";
import type { SocketServerEvents } from "./types";
import type { ServerToClientEvents, ClientToServerEvents } from "./socketTypes";
import type { Player } from "./types";
import { Socket as IOSocket } from "socket.io";

const app: Application = express();
const httpServer = createServer(app);
const allowedOrigins = [
  "https://letspartyallnight-frontend.vercel.app",
  "https://letspartyallnight.games",
  "https://www.letspartyallnight.games",
  "https://letspartyallnight-frontend-74ga0qmkq-alysia-barhams-projects.vercel.app",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

const io = new Server<ClientToServerEvents, ServerToClientEvents, SocketServerEvents>(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  pingTimeout: 30000,
  pingInterval: 25000,
});

const rooms: Record<string, Room> = {};

function createRoom(code: string, hostId: string, hostName: string): Room {
  return {
    code,
    hostId,
    players: [{ id: hostId, name: hostName, role: "player" }],
    entries: [],
    guesses: {},
    judgeRanking: [],
    selectedEntries: [],
    totalScores: {},
    round: 1,
    roundLimit: 5,
    phase: "lobby",
    phaseStartTime: Date.now(),
    judgeName: null,
    category: null,
    state: "lobby",
    maxPlayers: 8,
    gameData: {},
  };
}

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getPlayer(socketId: string, roomCode: string) {
  const room = rooms[roomCode.toUpperCase()];
  return room?.players.find((p: Player) => p.id === socketId);
}

const categories = [
  "Best Ice Cream Flavors",
  "Things That Are Underrated",
  "What Helps You Relax",
  "Favorite Breakfast Foods",
  "Most Useless College Majors",
  "Things You'd Bring to a Desert Island",
  "Top Excuses for Being Late",
  "What to Avoid on a First Date",
  "Best Fast Food Chains",
  "Worst Chores",
  "Most Annoying Sounds",
  "Best Ways to Spend a Rainy Day",
  "Essential Road Trip Snacks",
  "Most Important Inventions",
  "Things You Can't Live Without",
  "Best Pizza Toppings",
  "Worst Habits",
  "Favorite Things",
  "Best Types of Vacation",
  "Best Coffee Drinks",
  "Worst Vegetable",
  "Best Dessert Toppings",
  "Most Comforting Foods",
  "Best Breakfast Cereals",
  "Worst Candies",
  "Best Sandwich Fillings",
  "Most Refreshing Drinks",
  "Best Potato Chip Flavors",
  "Worst Holiday Foods",
  "Best Condiments",
  "Most Satisfying Snacks",
  "Best Fruits",
  "Worst Restaurant Experiences",
  "Best Cheeses",
  "Best Superheroes",
  "Foods I Would Never Try",
  "Worst Reality TV Shows",
  "Most Iconic Movie Quotes",
  "Best Animated Movies",
  "Worst Song to Hear on Repeat",
  "Best TV Show Endings",
  "Most Bingeworthy TV Series",
  "Best Video Game Genres",
  "Fictional Villains You Love to Hate",
  "Best Board Games",
  "Most Overrated Movies",
  "The GOAT in Music",
  "Worst Movie Tropes",
  "Best Music Genres",
  "Most Underrated Cartoons",
  "Most Important Virtues",
  "Things That Are Truly Beautiful",
  "Worst Ways to Die",
  "Most Important Life Lessons",
  "Best Ways to Learn",
  "Most Annoying Personality Traits",
  "Best Qualities in a Friend",
  "Worst Things to Say",
  "Most Important Freedoms",
  "Best Forms of Art",
  "Worst Excuses for Bad Behavior",
  "Most Impactful Historical Events",
  "Best Ways to Give Back",
  "Worst Inventions",
  "Scams",
  "Best Things to Yell in a Library",
  "Worst Places to Fall Asleep",
  "Most Embarrassing Moments",
  "Best Comebacks",
  "Worst Pick-Up Lines",
  "Most Annoying Things People Do",
  "Best Animal Noises",
  "Worst Superpowers",
  "Most Likely to Survive an Apocalypse",
  "Best Things to Find in Your Couch",
  "Worst Things to Step On Barefoot",
  "Most Absurd Laws",
  "Best Pranks",
  "Worst Things to Say at a Funeral",
  "Most Creative Ways to Procrastinate",
  "Best Sports to Watch",
  "Worst Hobbies to Pick Up",
  "Fake Jobs",
  "Best Outdoor Activities",
  "Worst Indoor Activities",
  "Best Books",
  "Most Challenging Skills to Learn",
  "Best Ways to Exercise",
  "Worst Things About Social Media",
  "Best Places to Travel",
  "Most Annoying Tech Problems",
  "Best Ways to Spend Money",
  "Worst Ways to Save Money",
  "School Subjects That Should Exist",
  "Best Things to Collect",
  "Most Underrated Kitchen Utensils",
  "Best Smells",
  "Worst Smells",
  "Medical/Health Myths",
  "Best Things to Do on a Long Flight",
  "Worst Fashion Trends",
  "Most Overused Phrases",
  "Best Animals to Have as Pets",
  "Worst Animals to Have as Pets",
  "Most Common Misconceptions",
  "Favorite Things",
  "Worst Things",
];

const isAlphanumeric = (text: string): boolean => /^[a-zA-Z0-9]+$/.test(text);

function shuffleArray(arr: string[]): string[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

app.set("trust proxy", 1);
const port = process.env.PORT || 10000;

if (require.main === module) {
  httpServer.listen(port, () => {
    console.log(`✅ Backend server listening at http://localhost:${port}`);
  });
}

// --- Rate Limiting ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowsMs
  message: "Too many requests from this IP, please try again after 15 minutes.",
});

const createRoomLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 room creation attempts per hour
  message: "Too many room creation attempts from this IP, please try again after an hour.",
});

// --- Middleware ---
app.use(helmet());
app.use(express.json());
app.use(apiLimiter); // Apply apiLimiter globally to all routes
app.all("/socket.io/*", (_req, res) => {
  res.status(400).send("Polling transport blocked");
});

// --- Routes ---
app.get("/", (_req, res) => {
  res.send("Hello from the Let's Party All Night backend!");
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    activeRooms: Object.keys(rooms).length,
  });
});

app.post("/create-room", createRoomLimiter, async (req, res) => {
  const { hostId } = req.body as { hostId: string };
  const hostName = hostId;

  if (!hostId || !isAlphanumeric(hostId)) {
    return res.status(400).json({ error: "Host name must be alphanumeric." });
  }

  let roomCode = generateRoomCode();
  roomCode = roomCode.toUpperCase();

  while (rooms[roomCode]) {
    roomCode = generateRoomCode().toUpperCase();
  }

  const newRoom = createRoom(roomCode, hostId, hostName);
  rooms[roomCode] = newRoom;

  console.log(`Room created: ${roomCode} by ${hostId}`);
  // Add host to room explicitly
  await io.to(newRoom.hostId).emit("playerJoined", {
    success: true,
    roomCode,
    playerName: hostName,
    players: newRoom.players,
    message: `${hostName} has created and joined the room.`,
  });
  return res.status(201).json({
    message: "Room created successfully!",
    roomCode,
    room: rooms[roomCode],
  });
});

app.post("/join-room", async (req, res) => {
  const { roomCode, playerId, socketId } = req.body;

  if (
    typeof roomCode !== "string" ||
    typeof playerId !== "string" ||
    typeof socketId !== "string" ||
    !isAlphanumeric(roomCode) ||
    !isAlphanumeric(playerId)
  ) {
    console.log("🚫 /join-room invalid payload:", { roomCode, playerId, socketId });
    return res.status(400).json({ error: "Invalid roomCode, playerId, or socketId" });
  }

  const upperCode = roomCode.toUpperCase();
  const room = rooms[upperCode];

  if (!room) {
    console.log("🚫 /join-room room not found:", upperCode);
    return res.status(404).json({ error: "Room not found" });
  }

  if (room.players.length >= 10) {
    console.log("🚫 /join-room room full:", upperCode);
    return res.status(400).json({ error: "Room is full" });
  }

  if (room.players.some((p) => p.name === playerId)) {
    console.log("🚫 /join-room name taken:", { playerId, roomCode: upperCode });
    return res.status(400).json({ error: "Name already taken in this room" });
  }

  // Add player to room
  room.players.push({ id: socketId, name: playerId, role: "player" });

  console.log("✅ /join-room success:", { roomCode: upperCode, playerId, socketId });

  // Emit playerJoined to the joining player
  await io.to(socketId).emit("playerJoined", {
    success: true,
    roomCode: upperCode,
    playerName: playerId,
    players: room.players,
    message: `${playerId} has joined the game.`,
  });

  // Update all players in the room with the new player list
  io.to(upperCode).emit("playerList", {
    players: room.players.map((p: Player) => p.name),
  });

  return res.status(200).json({ message: "Successfully joined room!", room: { code: upperCode } });
});

// --- Socket.IO Events ---
io.on("connection", (socket: IOSocket) => {
  console.log(`⚡ Socket connected: ${socket.id}`);

  socket.on("joinGameRoom", async (payload: { roomCode: string; playerName: string }) => {
    const { roomCode, playerName } = payload;
    const upperCode = roomCode.toUpperCase();

    if (
      typeof roomCode !== "string" ||
      typeof playerName !== "string" ||
      !isAlphanumeric(playerName) ||
      playerName.length > 20
    ) {
      socket.emit("joinError", { message: "Invalid room code or name." });
      return;
    }

    await socket.join(upperCode);
    const room = rooms[upperCode];

    if (!room) {
      socket.emit("joinError", { message: "Room not found." });
      return;
    }

    console.log(
      "📍 joinGameRoom players before check:",
      room.players.map((p) => ({ id: p.id, name: p.name })),
    );
    const nameTaken = room.players.some((p) => p.name === playerName && p.id !== socket.id);
    if (nameTaken) {
      socket.emit("joinError", { message: "Name already taken in this room." });
      console.log("🚫 joinGameRoom rejected:", { playerName, socketId: socket.id });
      return;
    }

    const existingPlayer = room.players.find((p) => p.name === playerName);
    if (!existingPlayer) {
      room.players.push({ id: socket.id, name: playerName, role: "player" });
    }

    console.log(`🌐 ${playerName} (${socket.id}) joined ${upperCode}`);
    io.to(upperCode).emit("playerJoined", {
      success: true,
      roomCode: upperCode,
      playerName,
      players: room.players,
      message: `${playerName} has joined the game.`,
    });

    socket.emit("roomState", {
      players: room.players,
      phase: room.phase,
      round: room.round,
      judgeName: room.judgeName,
      category: room.category,
      state: room.state,
    });
  });

  socket.on(
    "setRole",
    (payload: { roomCode: string; playerName: string; role: "player" | "spectator" }) => {
      const { roomCode, playerName, role } = payload;
      const upperCode = roomCode.toUpperCase();
      const room = rooms[upperCode];
      if (!room) return;

      const player = room.players.find((p: Player) => p.name === playerName);
      if (player) {
        player.role = role;
        console.log(`🎭 Role set for ${playerName} in ${upperCode}: ${role}`);
      }

      socket.emit("roomState", {
        players: room.players,
        phase: room.phase,
        round: room.round,
        judgeName: room.judgeName,
        category: room.category,
        state: room.state,
      });

      const judge = room.players.find((p) => p.name === room.judgeName);
      if (room.phase === "ranking" && room.judgeName === playerName && !judge?.hasRanked) {
        const anonymousEntries = room.entries.map((e) => e.entry);
        io.to(socket.id).emit("sendAllEntries", { entries: anonymousEntries });
        console.log(`✅ Re-sent entries to Judge (${playerName}) on refresh during ranking phase`);
      }
    },
  );

  socket.on("startGame", (payload: { roomCode: string; roundLimit?: number }) => {
    const { roomCode, roundLimit } = payload;
    const upperCode = roomCode.toUpperCase();
    const room = rooms[upperCode];
    if (!room) return;

    const host = getPlayer(socket.id, upperCode);
    if (host?.role !== "player") {
      console.log(`🚫 Spectator tried to start the game`);
      socket.emit("toastWarning", { message: "Only players can start the game." });
      return;
    }

    if (room.players.length < 2) {
      console.log(`🚫 Not enough players to start game in ${upperCode}`);
      socket.emit("toastWarning", {
        message: "At least 2 players are required to start the game.",
      });
      return;
    }

    room.roundLimit = roundLimit || 5;
    room.round = 1;
    room.phase = "entry";
    room.totalScores = {};
    room.entries = [];
    room.guesses = {};

    const category = categories[Math.floor(Math.random() * categories.length)];
    const judgeIndex = (room.round - 1) % room.players.length;
    const judgeName = room.players[judgeIndex]?.name ?? null;
    room.judgeName = judgeName;
    room.category = category ?? "Misc";
    room.phaseStartTime = Date.now();

    io.to(upperCode).emit("phaseChange", { phase: room.phase });
    io.to(upperCode).emit("roomState", {
      players: room.players,
      phase: room.phase,
      round: room.round,
      judgeName: room.judgeName,
      category: room.category,
      state: room.state,
    });

    console.log(`[${new Date().toISOString()}] 🔄 Phase changed to: ${room.phase} in ${upperCode}`);
    console.log(
      `🎮 Game started in ${upperCode} | Round ${room.round}/${room.roundLimit} | Judge: ${judgeName}`,
    );

    io.to(upperCode).emit("gameStarted", {
      category: category ?? "Misc",
      round: room.round,
    });
  });

  socket.on("submitEntry", (payload: { roomCode: string; playerName: string; entry: string }) => {
    const { roomCode, playerName, entry } = payload;
    const upperCode = roomCode.toUpperCase();
    const room = rooms[upperCode];
    if (!room) return;

    if (!entry || !isAlphanumeric(entry.replace(/\s+/g, ""))) {
      console.log(`🚫 Invalid entry from ${playerName}: ${entry}`);
      socket.emit("toastWarning", { message: "Entry must be alphanumeric." });
      return;
    }

    const player = getPlayer(socket.id, roomCode);
    if (player?.role !== "player") {
      console.log(`🚫 Spectator ${playerName} tried to submit an entry`);
      socket.emit("toastWarning", { message: "Spectators cannot submit entries." });
      return;
    }

    room.entries.push({ playerName, entry });

    console.log(`✍️ Entry from ${playerName} in ${upperCode}: ${entry}`);
    room.players.forEach((p: Player) => {
      if (p.role === "spectator") {
        io.to(p.id).emit("newEntry", { entry });
      }
    });

    const judgeSocket = room.players.find((p: Player) => p.name === room.judgeName)?.id;
    if (judgeSocket) {
      const anonymousEntries = room.entries.map((e) => e.entry);
      io.to(judgeSocket).emit("sendAllEntries", { entries: anonymousEntries });
      console.log(`📨 Updated entries sent to Judge (${room.judgeName})`);
    }

    socket.emit("roomState", {
      players: room.players,
      phase: room.phase,
      round: room.round,
      judgeName: room.judgeName,
      category: room.category,
      state: room.state,
    });
  });

  socket.on("startRankingPhase", (payload: { roomCode: string; judgeName: string }) => {
    const { roomCode, judgeName } = payload;
    const upperCode = roomCode.toUpperCase();
    const room = rooms[upperCode];
    if (!room) return;

    const initiator = getPlayer(socket.id, upperCode);
    if (initiator?.role !== "player") {
      console.log(`🚫 Spectator tried to start ranking phase`);
      socket.emit("toastWarning", { message: "Spectators cannot start ranking phase." });
      return;
    }

    const uniqueEntries = [...new Set(room.entries.map((e) => e.entry))];
    if (uniqueEntries.length < 5) {
      socket.emit("toastWarning", {
        message: "Not enough unique entries yet. At least 5 needed.",
      });
      console.log(`🚫 Not enough unique entries in ${upperCode}:`, uniqueEntries.length);
      return;
    }

    room.phase = "ranking";
    room.phaseStartTime = Date.now();
    room.judgeName = judgeName;

    io.to(upperCode).emit("phaseChange", { phase: room.phase });
    io.to(upperCode).emit("startRankingPhase", { judgeName });

    const judgeSocket = room.players.find((p: Player) => p.name === judgeName)?.id || socket.id;
    const anonymousEntries = room.entries.map((e) => e.entry);

    io.to(judgeSocket).emit("sendAllEntries", { entries: anonymousEntries });
    io.to(judgeSocket).emit("roomState", {
      players: room.players,
      phase: room.phase,
      round: room.round,
      judgeName: room.judgeName,
      category: room.category,
      state: room.state,
    });

    console.log(`[${new Date().toISOString()}] 🔄 Phase changed to: ${room.phase} in ${upperCode}`);
    console.log(`🔔 Ranking phase started in ${upperCode} by judge ${judgeName}`);
  });

  socket.on("submitRanking", (payload: RankingPayload) => {
    const { roomCode, ranking } = payload;
    const upperCode = roomCode.toUpperCase();
    const room = rooms[upperCode];
    if (!room) return;

    const judge = getPlayer(socket.id, upperCode);
    if (!judge || judge.name !== room.judgeName) {
      console.log(`🚫 Non-judge tried to submit ranking`);
      socket.emit("toastWarning", { message: "Only the judge can submit rankings." });
      return;
    }

    if (judge.hasRanked) {
      console.log(`🚫 Judge already submitted ranking. Ignoring.`);
      socket.emit("toastWarning", { message: "You have already submitted your ranking." });
      return;
    }

    judge.hasRanked = true;
    room.judgeRanking = ranking;
    room.selectedEntries = ranking;

    const shuffled = shuffleArray(ranking);
    io.to(upperCode).emit("sendAllEntries", { entries: shuffled });

    console.log(`✅ Shuffled ranking sent to guessers in ${upperCode}:`, shuffled);
  });

  socket.on("requestEntries", (payload: { roomCode: string }) => {
    const { roomCode } = payload;
    const upperCode = roomCode.toUpperCase();
    const room = rooms[upperCode];
    if (!room || !room.selectedEntries) return;

    io.to(socket.id).emit("sendAllEntries", { entries: room.selectedEntries });
  });

  socket.on("submitGuess", (payload: SubmitGuessPayload) => {
    const { roomCode, playerName, guess } = payload;
    const upperCode = roomCode.toUpperCase();
    const room = rooms[upperCode];
    if (!room) return;

    if (room.guesses[playerName]) {
      console.log(`🚫 Player ${playerName} already submitted a guess. Ignoring.`);
      socket.emit("toastWarning", { message: "You have already submitted a guess." });
      return;
    }

    const player = getPlayer(socket.id, roomCode);
    if (player?.role !== "player") {
      console.log(`🚫 Spectator ${playerName} tried to submit a guess`);
      socket.emit("toastWarning", { message: "Spectators cannot submit guesses." });
      return;
    }

    room.guesses[playerName] = guess;
    if (player?.name === playerName) {
      player.hasGuessed = true;
    }

    const guessers = room.players.filter(
      (p: Player) => p.name !== room.judgeName && p.name !== room.hostId,
    );
    const received = guessers.filter((p: Player) => room.guesses[p.name]).length;

    if (received >= guessers.length) {
      room.phase = "reveal";
      room.phaseStartTime = Date.now();
      io.to(upperCode).emit("phaseChange", { phase: room.phase });

      const judgeRanking = room.judgeRanking;
      const results: Record<string, PlayerResult> = {};

      for (const [name, guess] of Object.entries(room.guesses)) {
        let score = 0;
        for (let i = 0; i < guess.length; i++) {
          if (guess[i] === judgeRanking[i]) score++;
        }
        if (score === judgeRanking.length) score += 3;
        results[name] = { guess, score };
      }

      io.to(upperCode).emit("revealResults", { judgeRanking, results });

      if (!room.totalScores) room.totalScores = {};
      for (const [name, result] of Object.entries(results)) {
        room.totalScores[name] = (room.totalScores[name] || 0) + result.score;
      }

      if (room.round < room.roundLimit) {
        room.round++;
        const judgeIndex = (room.round - 1) % room.players.length;
        const judgeName = room.players[judgeIndex]?.name ?? null;
        room.judgeName = judgeName;
        room.entries = [];
        room.guesses = {};
        room.phase = "entry";
        room.phaseStartTime = Date.now();
        io.to(upperCode).emit("phaseChange", { phase: room.phase });
        console.log(
          `[${new Date().toISOString()}] 🔄 Phase changed to: ${room.phase} in ${upperCode}`,
        );

        const nextCategory = categories[Math.floor(Math.random() * categories.length)] ?? "Misc";
        io.to(upperCode).emit("gameStarted", {
          category: nextCategory,
          round: room.round,
        });
      } else {
        io.to(upperCode).emit("finalScores", { scores: room.totalScores });
        console.log(`🏁 Game ended in ${upperCode}. Final scores:`, room.totalScores);
      }
    }
  });

  socket.on("restartGame", (payload: { roomCode: string }) => {
    const { roomCode } = payload;
    const upperCode = roomCode.toUpperCase();
    const room = rooms[upperCode];
    if (!room) return;

    room.round = 1;
    room.entries = [];
    room.guesses = {};
    room.judgeRanking = [];
    room.selectedEntries = [];
    room.totalScores = {};
    room.phase = "entry";
    room.phaseStartTime = Date.now();
    io.to(upperCode).emit("phaseChange", { phase: room.phase });
    console.log(`[${new Date().toISOString()}] 🔄 Phase changed to: ${room.phase} in ${roomCode}`);

    const category = categories[Math.floor(Math.random() * categories.length)] ?? "Misc";
    const judgeIndex = (room.round - 1) % room.players.length;
    const judgeName = room.players[judgeIndex]?.name ?? "Unknown";
    room.judgeName = judgeName;

    console.log(`🔄 Game restarted in ${upperCode} | Judge: ${judgeName}`);
    io.to(upperCode).emit("gameStarted", {
      category,
      round: room.round,
    });
  });

  setInterval(() => {
    Object.entries(rooms).forEach(([code, room]) => {
      if (room.phase === "ranking" && room.phaseStartTime) {
        const timeout = 60000; // 1 minute
        if (Date.now() - room.phaseStartTime > timeout && !room.judgeRanking) {
          console.log(
            `[${new Date().toISOString()}] ⏰ Timeout reached. Auto-advancing ${code} to reveal.`,
          );

          const fallbackRanking = shuffleArray(room.entries.map((e) => e.entry));
          room.judgeRanking = fallbackRanking;
          room.selectedEntries = fallbackRanking;

          room.phase = "reveal";
          room.phaseStartTime = Date.now();
          io.to(code).emit("phaseChange", { phase: room.phase });

          const results: Record<string, PlayerResult> = {};
          for (const [name, guess] of Object.entries(room.guesses)) {
            let score = 0;
            for (let i = 0; i < guess.length; i++) {
              if (guess[i] === fallbackRanking[i]) score++;
            }
            if (score === fallbackRanking.length) score += 3;
            results[name] = { guess, score };
          }

          io.to(code).emit("revealResults", { judgeRanking: fallbackRanking, results });

          for (const [name, result] of Object.entries(results)) {
            room.totalScores[name] = (room.totalScores[name] || 0) + result.score;
          }

          if (room.round < room.roundLimit) {
            room.round++;
            const judgeIndex = (room.round - 1) % room.players.length;
            room.judgeName = room.players[judgeIndex]?.name ?? null;
            room.entries = [];
            room.guesses = {};
            room.phase = "entry";
            room.phaseStartTime = Date.now();

            const nextCategory =
              categories[Math.floor(Math.random() * categories.length)] ?? "Misc";
            io.to(code).emit("phaseChange", { phase: room.phase });
            io.to(code).emit("gameStarted", {
              category: nextCategory,
              round: room.round,
            });
          } else {
            io.to(code).emit("finalScores", { scores: room.totalScores });
            console.log(`🏁 Game ended in ${code}. Final scores:`, room.totalScores);
          }
        }
      }
    });
  }, 10000);

  socket.on("disconnect", () => {
    for (const [code, room] of Object.entries(rooms)) {
      const before = room.players.length;
      room.players = room.players.filter((p) => p.id !== socket.id);
      const after = room.players.length;

      if (before !== after) {
        console.log(`🔌 Disconnected: ${socket.id} removed from room ${code}`);
        io.to(code).emit("playerList", {
          players: room.players.map((p) => p.name),
        });
      }
    }
  });
});
