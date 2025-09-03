// src/types/socket.ts

export type EmitPayloads = {
  "player:join": { name: string; roomId: string };
  "player:leave": { playerId: string };
  "game:start": { roomId: string };
};

export type ListenPayloads = {
  "player:list": { players: string[] };
  "game:state": { started: boolean };
  error: { message: string };
};

export type SubmitGuessPayload = {
  roomCode: string;
  playerName: string;
  guess: string[];
};

export type GuessPayload = {
  roomCode: string;
  playerName: string;
  guess: string[];
};

export type RankingPayload = {
  roomCode: string;
  ranking: string[];
};

export type EntryPayload = {
  roomCode: string;
  playerName: string;
  entry: string;
};

export type GameStartPayload = {
  roomCode: string;
  roundLimit?: number;
};

export type Player = {
  id: string;
  name: string;
  role?: "player" | "spectator";
  hasGuessed?: boolean;
  hasRanked?: boolean;
};

export type Phase = "entry" | "ranking" | "reveal";

export type Room = {
  code: string;
  hostId: string;
  players: Player[];
  entries: { playerName: string; entry: string }[];
  guesses: Record<string, string[]>;
  judgeRanking: string[];
  selectedEntries: string[];
  totalScores: Record<string, number>;
  round: number;
  roundLimit: number;
  phase: "lobby" | "entry" | "ranking" | "reveal";
  phaseStartTime?: number;
  judgeName: string | null;
  category: string | null;
  state: "lobby" | "active" | "ended";
  maxPlayers: number;
  gameData: Record<string, unknown>;
};

export type SocketServerEvents = {
  joinError: (error: string) => void;
  gameStarted: () => void;
  startRankingPhase: () => void;
};

export type PlayerResult = {
  guess: string[];
  score: number;
};
