export interface OverlayState {
    gameType: 'BONUS' | 'TRIVIA' | null;
    gameStatus: 'IDLE' | 'RUNNING' | 'OPENING' | 'CLOSED';
    gameId?: string;
    timestamp: string;
}
export interface BonusOverlayState extends OverlayState {
    gameType: 'BONUS';
    bonuses: BonusInfo[];
    entries: BonusEntryInfo[];
    payouts: BonusPayoutInfo[];
    leaderboard: LeaderboardEntry[];
    totalPayout?: number;
    phase: 'HUNT' | 'OPENING' | 'CLOSED';
}
export interface TriviaOverlayState extends OverlayState {
    gameType: 'TRIVIA';
    currentRound?: TriviaRoundInfo;
    scores: TriviaScoreInfo[];
    leaderboard: TriviaLeaderboardEntry[];
    totalRounds: number;
}
export interface BonusInfo {
    id: string;
    name: string;
    amountX: number;
    createdAt: string;
}
export interface BonusEntryInfo {
    id: string;
    userId: string;
    username: string;
    guess: number;
    createdAt: string;
}
export interface BonusPayoutInfo {
    id: string;
    bonusName: string;
    amountX: number;
    createdAt: string;
}
export interface LeaderboardEntry {
    rank: number;
    userId: string;
    username: string;
    guess: number;
    delta?: number;
    isWinner: boolean;
}
export interface TriviaRoundInfo {
    id: string;
    question: string;
    status: 'OPEN' | 'LOCKED' | 'CLOSED';
    startedAt: string;
    endedAt?: string;
    timeLeft?: number;
}
export interface TriviaScoreInfo {
    userId: string;
    username: string;
    points: number;
    correctAnswers: number;
    totalAnswers: number;
    accuracy: number;
}
export interface TriviaLeaderboardEntry {
    rank: number;
    userId: string;
    username: string;
    points: number;
    correctAnswers: number;
    accuracy: number;
}
export interface OverlayEvent {
    type: string;
    data: any;
    timestamp: string;
}
export interface BonusEvent extends OverlayEvent {
    type: 'bonus.state' | 'bonus.final' | 'bonus.entry' | 'bonus.payout';
    data: BonusOverlayState | BonusEntryInfo | BonusPayoutInfo;
}
export interface TriviaEvent extends OverlayEvent {
    type: 'trivia.state' | 'trivia.scores' | 'trivia.round' | 'trivia.answer';
    data: TriviaOverlayState | TriviaScoreInfo[] | TriviaRoundInfo;
}
export interface OverlayConnectionInfo {
    id: string;
    connectedAt: string;
    lastActivity: string;
    userAgent?: string;
    ip?: string;
}
//# sourceMappingURL=dto.d.ts.map