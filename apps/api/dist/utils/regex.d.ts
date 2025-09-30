export declare const KICK_COMMAND_PATTERNS: {
    readonly GUESS: RegExp;
    readonly LINK: RegExp;
    readonly ANSWER: RegExp;
};
export declare function sanitizeInput(input: string): string;
export declare function normalizeAnswer(answer: string): string;
export declare function levenshteinDistance(str1: string, str2: string): number;
export declare function isAnswerClose(userAnswer: string, correctAnswer: string, threshold?: number): boolean;
export declare function parseKickMessage(message: string): {
    type: 'guess' | 'link' | 'answer' | 'unknown';
    data?: any;
};
//# sourceMappingURL=regex.d.ts.map