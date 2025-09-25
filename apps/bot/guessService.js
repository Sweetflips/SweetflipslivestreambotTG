// Simple GuessService for bot.js to store guesses in database
// This avoids import path issues in Railway deployment

export class GuessService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async submitGuess(userId, gameType, value) {
    try {
      // Get or create current game round
      let round = await this.getCurrentRound(gameType);
      
      if (!round) {
        // Create new round if none exists - using only basic fields that exist in database
        round = await this.prisma.gameRound.create({
          data: {
            type: gameType,
            phase: "OPEN",
            minRange: 1,
            maxRange: 1000000,
            graceWindow: 30,
            windowMin: 0,
          },
        });
      }

      // Check if user already has a guess for this round
      const existingGuess = await this.prisma.guess.findUnique({
        where: {
          gameRoundId_userId: {
            gameRoundId: round.id,
            userId: userId,
          },
        },
      });

      if (existingGuess) {
        return {
          success: false,
          message: "⛔️ You already have a guess recorded. Only one guess per game allowed.",
        };
      }

      // Check if this guess value is already taken by another user
      const duplicateGuess = await this.prisma.guess.findFirst({
        where: {
          gameRoundId: round.id,
          value: value,
        },
      });

      if (duplicateGuess) {
        return {
          success: false,
          message: "⛔️ This guess has already been submitted by another player. Please choose a different number.",
        };
      }

      // Create the guess
      await this.prisma.guess.create({
        data: {
          gameRoundId: round.id,
          userId: userId,
          value: value,
        },
      });

      return {
        success: true,
        message: `✅ Saved *${value}*. You can edit once within ${round.graceWindow}s with /${gameType === "GUESS_BALANCE" ? "gtbalance" : "gtbonus"} again.`,
        isEdit: false,
        graceWindowRemaining: round.graceWindow,
      };
    } catch (error) {
      console.error("Error in submitGuess:", error);
      return {
        success: false,
        message: "❌ An error occurred while saving your guess. Please try again.",
      };
    }
  }

  async getCurrentRound(gameType) {
    try {
      return await this.prisma.gameRound.findFirst({
        where: {
          type: gameType,
          phase: "OPEN",
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    } catch (error) {
      console.error("Error getting current round:", error);
      return null;
    }
  }

  async openRound(gameType, userId) {
    try {
      // Close any existing open rounds of this type
      await this.prisma.gameRound.updateMany({
        where: {
          type: gameType,
          phase: "OPEN",
        },
        data: {
          phase: "CLOSED",
          closedAt: new Date(),
        },
      });

      // Create new round
      const round = await this.prisma.gameRound.create({
        data: {
          type: gameType,
          phase: "OPEN",
          minRange: 1,
          maxRange: 1000000,
          graceWindow: 30,
          windowMin: 0,
        },
      });

      return `✅ New ${gameType} round opened!`;
    } catch (error) {
      console.error("Error opening round:", error);
      return "❌ Failed to open new round.";
    }
  }

  async closeRound(gameType, userId) {
    try {
      const round = await this.prisma.gameRound.findFirst({
        where: {
          type: gameType,
          phase: "OPEN",
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (!round) {
        return "❌ No open round found.";
      }

      await this.prisma.gameRound.update({
        where: { id: round.id },
        data: {
          phase: "CLOSED",
          closedAt: new Date(),
        },
      });

      return `✅ ${gameType} round closed!`;
    } catch (error) {
      console.error("Error closing round:", error);
      return "❌ Failed to close round.";
    }
  }

  async resetRound(gameType, userId) {
    try {
      // Close any open rounds
      await this.prisma.gameRound.updateMany({
        where: {
          type: gameType,
          phase: "OPEN",
        },
        data: {
          phase: "CLOSED",
          closedAt: new Date(),
        },
      });

      return `✅ ${gameType} round reset!`;
    } catch (error) {
      console.error("Error resetting round:", error);
      return "❌ Failed to reset round.";
    }
  }
}