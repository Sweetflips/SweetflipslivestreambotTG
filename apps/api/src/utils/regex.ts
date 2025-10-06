// Kick chat command patterns
export const KICK_COMMAND_PATTERNS = {
  GUESS: /^!guess\s+(\d+)$/i,
  LINK: /^!link\s+([a-zA-Z0-9]{8})$/i,
  ANSWER: /^!answer\s+(.+)$/i,
} as const;

// Input sanitization
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 1000); // Limit length
}

// Normalize trivia answers for comparison
export function normalizeAnswer(answer: string): string {
  return answer
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' '); // Normalize whitespace
}

// Calculate Levenshtein distance for fuzzy matching
export function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) {
    matrix[0]![i] = i;
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[j]![0] = j;
  }

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j]![i] = Math.min(
        matrix[j]![i - 1]! + 1, // deletion
        matrix[j - 1]![i]! + 1, // insertion
        matrix[j - 1]![i - 1]! + indicator // substitution
      );
    }
  }

  return matrix[str2.length]![str1.length]!;
}

// Check if answer is close enough (fuzzy match)
export function isAnswerClose(userAnswer: string, correctAnswer: string, threshold: number = 2): boolean {
  const normalizedUser = normalizeAnswer(userAnswer);
  const normalizedCorrect = normalizeAnswer(correctAnswer);

  // Exact match
  if (normalizedUser === normalizedCorrect) {
    return true;
  }

  // Fuzzy match
  const distance = levenshteinDistance(normalizedUser, normalizedCorrect);
  return distance <= threshold;
}

// Parse Kick chat message
export function parseKickMessage(message: string): {
  type: 'guess' | 'link' | 'answer' | 'unknown';
  data?: any;
} {
  const trimmed = message.trim();

  // Check for guess command
  const guessMatch = trimmed.match(KICK_COMMAND_PATTERNS.GUESS);
  if (guessMatch) {
    const guess = parseInt(guessMatch[1] ?? '0', 10);
    if (guess >= 0 && guess <= 1000) {
      return { type: 'guess', data: { guess } };
    }
  }

  // Check for link command
  const linkMatch = trimmed.match(KICK_COMMAND_PATTERNS.LINK);
  if (linkMatch) {
    return { type: 'link', data: { code: linkMatch[1] } };
  }

  // Check for answer command
  const answerMatch = trimmed.match(KICK_COMMAND_PATTERNS.ANSWER);
  if (answerMatch) {
    return { type: 'answer', data: { answer: sanitizeInput(answerMatch[1] ?? '') } };
  }

  return { type: 'unknown' };
}
