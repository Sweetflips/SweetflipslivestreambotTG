import { describe, expect, it } from 'vitest';
import { TriviaLogic } from '../../modules/games/trivia/triviaLogic.js';

describe('TriviaLogic', () => {
  describe('evaluateAnswer', () => {
    it('should evaluate exact matches as correct', () => {
      expect(TriviaLogic.evaluateAnswer('apple', 'apple')).toBe(true);
      expect(TriviaLogic.evaluateAnswer('Apple', 'apple')).toBe(true);
      expect(TriviaLogic.evaluateAnswer('APPLE', 'apple')).toBe(true);
    });

    it('should evaluate case-insensitive matches', () => {
      expect(TriviaLogic.evaluateAnswer('New York', 'new york')).toBe(true);
      expect(TriviaLogic.evaluateAnswer('NEW YORK', 'new york')).toBe(true);
    });

    it('should evaluate punctuation-insensitive matches', () => {
      expect(TriviaLogic.evaluateAnswer('Hello, World!', 'hello world')).toBe(true);
      expect(TriviaLogic.evaluateAnswer('What\'s up?', 'whats up')).toBe(true);
    });

    it('should evaluate fuzzy matches within distance', () => {
      expect(TriviaLogic.evaluateAnswer('appl', 'apple')).toBe(true); // Distance 1
      expect(TriviaLogic.evaluateAnswer('aple', 'apple')).toBe(true); // Distance 1
      expect(TriviaLogic.evaluateAnswer('ap', 'apple')).toBe(false); // Distance 3
    });

    it('should reject incorrect answers', () => {
      expect(TriviaLogic.evaluateAnswer('banana', 'apple')).toBe(false);
      expect(TriviaLogic.evaluateAnswer('orange', 'apple')).toBe(false);
    });
  });

  describe('validateQuestion', () => {
    it('should validate correct questions', () => {
      expect(TriviaLogic.validateQuestion('What is the capital of France?')).toEqual({ valid: true });
      expect(TriviaLogic.validateQuestion('A')).toEqual({ valid: true });
    });

    it('should reject invalid questions', () => {
      expect(TriviaLogic.validateQuestion('')).toEqual({
        valid: false,
        error: 'Question cannot be empty'
      });
      expect(TriviaLogic.validateQuestion('A'.repeat(501))).toEqual({
        valid: false,
        error: 'Question too long (max 500 characters)'
      });
    });
  });

  describe('validateAnswer', () => {
    it('should validate correct answers', () => {
      expect(TriviaLogic.validateAnswer('Paris')).toEqual({ valid: true });
      expect(TriviaLogic.validateAnswer('A')).toEqual({ valid: true });
    });

    it('should reject invalid answers', () => {
      expect(TriviaLogic.validateAnswer('')).toEqual({
        valid: false,
        error: 'Answer cannot be empty'
      });
      expect(TriviaLogic.validateAnswer('A'.repeat(101))).toEqual({
        valid: false,
        error: 'Answer too long (max 100 characters)'
      });
    });
  });

  describe('calculateScores', () => {
    it('should calculate scores correctly', () => {
      const rounds = [
        {
          id: 'round1',
          answers: [
            {
              id: '1',
              userId: 'user1',
              text: 'correct',
              isCorrect: true,
              ts: new Date('2023-01-01T10:00:00Z'),
              user: { id: 'user1', kickName: 'user1', telegramUser: null },
            },
            {
              id: '2',
              userId: 'user2',
              text: 'correct',
              isCorrect: true,
              ts: new Date('2023-01-01T10:01:00Z'),
              user: { id: 'user2', kickName: 'user2', telegramUser: null },
            },
            {
              id: '3',
              userId: 'user1',
              text: 'wrong',
              isCorrect: false,
              ts: new Date('2023-01-01T10:02:00Z'),
              user: { id: 'user1', kickName: 'user1', telegramUser: null },
            },
          ],
        },
      ];

      const scores = TriviaLogic.calculateScores(rounds as any);

      expect(scores).toHaveLength(2);

      const user1Score = scores.find(s => s.userId === 'user1');
      expect(user1Score).toBeDefined();
      expect(user1Score?.points).toBe(1);
      expect(user1Score?.correctAnswers).toBe(1);
      expect(user1Score?.totalAnswers).toBe(2);

      const user2Score = scores.find(s => s.userId === 'user2');
      expect(user2Score).toBeDefined();
      expect(user2Score?.points).toBe(1);
      expect(user2Score?.correctAnswers).toBe(1);
      expect(user2Score?.totalAnswers).toBe(1);
    });
  });

  describe('generateLeaderboard', () => {
    it('should generate leaderboard correctly', () => {
      const scores = [
        {
          userId: 'user1',
          username: 'user1',
          points: 5,
          correctAnswers: 5,
          totalAnswers: 10,
          accuracy: 50,
        },
        {
          userId: 'user2',
          username: 'user2',
          points: 3,
          correctAnswers: 3,
          totalAnswers: 5,
          accuracy: 60,
        },
        {
          userId: 'user3',
          username: 'user3',
          points: 3,
          correctAnswers: 3,
          totalAnswers: 6,
          accuracy: 50,
        },
      ];

      const leaderboard = TriviaLogic.generateLeaderboard(scores);

      expect(leaderboard).toHaveLength(3);
      expect(leaderboard[0].userId).toBe('user1'); // Highest points
      expect(leaderboard[0].rank).toBe(1);
      expect(leaderboard[1].userId).toBe('user2'); // Higher accuracy than user3
      expect(leaderboard[1].rank).toBe(2);
      expect(leaderboard[2].userId).toBe('user3');
      expect(leaderboard[2].rank).toBe(3);
    });
  });
});

