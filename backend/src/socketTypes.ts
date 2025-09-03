import { RankingPayload, SubmitGuessPayload, PlayerResult, Player, Phase } from "./types";

export type ClientToServerEvents = {
  "player:join": (data: { name: string; roomId: string }) => void;
  joinGameRoom: (payload: { roomCode: string; playerName: string }) => void;
  startGame: (payload: { roomCode: string; roundLimit?: number }) => void;
  submitEntry: (payload: { roomCode: string; playerName: string; entry: string }) => void;
  startRankingPhase: (payload: { roomCode: string; judgeName: string }) => void;
  submitRanking: (payload: RankingPayload) => void;
  requestEntries: (payload: { roomCode: string }) => void;
  submitGuess: (payload: SubmitGuessPayload) => void;
  restartGame: (payload: { roomCode: string }) => void;
  setRole: (payload: {
    roomCode: string;
    playerName: string;
    role: "player" | "spectator";
  }) => void;
};

export type ServerToClientEvents = {
  joinError: (payload: { message: string }) => void;
  playerJoinError: (msg: string) => void;
  phaseChange: (data: { phase: Phase }) => void;
  playerJoined: (payload: {
    success: boolean;
    roomCode: string;
    playerName: string;
    players?: Player[];
    message?: string;
  }) => void;
  roomState: (payload: {
    players: Player[];
    phase: "lobby" | "entry" | "ranking" | "reveal";
    round: number;
    judgeName: string | null;
    category: string | null;
    state: string;
  }) => void;
  playerList: (data: { players: string[] }) => void;
  newEntry: (payload: { entry: string }) => void;
  sendAllEntries: (payload: { entries: string[] }) => void;
  gameStarted: (payload: { category: string; round: number }) => void;
  startRankingPhase: (payload: { judgeName: string }) => void;
  revealResults: (payload: {
    judgeRanking: string[];
    results: Record<string, PlayerResult>;
  }) => void;
  finalScores: (payload: { scores: Record<string, number> }) => void;
  toastWarning: (payload: { message: string }) => void;
};

export type GameState = {
  players: string[];
  status: "waiting" | "active" | "finished";
};
