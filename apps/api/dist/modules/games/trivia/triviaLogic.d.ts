export interface TriviaGameResult {
    gameId: string;
    totalRounds: number;
    scores: TriviaScore[];
    leaderboard: TriviaLeaderboardEntry[];
}
export interface TriviaScore {
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
export interface TriviaRoundResult {
    roundId: string;
    gameId: string;
    question: string;
    answer: string;
    correctAnswers: TriviaAnswerWithUser[];
    totalAnswers: number;
    correctCount: number;
}
export interface TriviaAnswerWithUser extends TriviaAnswer {
    user: {
        id: string;
        kickName: string | null;
        telegramUser: string | null;
    };
}
export declare class TriviaLogic {
    static evaluateAnswer(userAnswer: string, correctAnswer: string): boolean;
    static calculateScores(rounds: (TriviaRound & {
        answers: TriviaAnswerWithUser[];
    })[]): TriviaScore[];
    static generateLeaderboard(scores: TriviaScore[], topN?: number): TriviaLeaderboardEntry[];
    static validateQuestion(question: string): {
        valid: boolean;
        error?: string;
    };
    static validateAnswer(answer: string): {
        valid: boolean;
        error?: string;
    };
    static formatGameResult(result: TriviaGameResult): string;
    static formatRoundResult(result: TriviaRoundResult): string;
    static formatLeaderboard(leaderboard: TriviaLeaderboardEntry[]): string;
    static calculatePayoutDistribution(leaderboard: TriviaLeaderboardEntry[], totalPrizePool: number): Array<{
        userId: string;
        amount: number;
        percentage: number;
    }>;
    static getRoundStats(round: TriviaRound & {
        answers: TriviaAnswerWithUser[];
    }): {
        totalAnswers: number;
        correctAnswers: number;
        uniqueCorrectUsers: number;
        averageResponseTime: number;
    };
}
//# sourceMappingURL=triviaLogic.d.ts.map