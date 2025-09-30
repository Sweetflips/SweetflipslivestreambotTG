import { PrismaClient } from '@prisma/client';
import { getEnv } from '../../config/env.js';
import { logGameEvent, logUserAction, logger } from '../../telemetry/logger.js';
import { BonusService } from '../games/bonus/bonusService.js';
import { GuessCommands } from '../games/guess/guessCommands.js';
import { TriviaService } from '../games/trivia/triviaService.js';
import { LinkService } from '../linking/linkService.js';
import { PayoutService } from '../payouts/payoutService.js';
import { ScheduleService } from '../../services/scheduleService.js';
import { TelegramContext } from './middlewares.js';

const env = getEnv();

export class TelegramCommands {
  private guessCommands: GuessCommands;
  private scheduleService: ScheduleService;

  constructor(
    private prisma: PrismaClient,
    private bonusService: BonusService,
    private triviaService: TriviaService,
    private payoutService: PayoutService,
    private linkService: LinkService
  ) {
    // Initialize guess commands with required services
    const { GuessService } = require('../games/guess/guessService.js');
    const { BonusService: GuessBonusService } = require('../games/guess/bonusService.js');

    const guessService = new GuessService(prisma);
    const guessBonusService = new GuessBonusService(prisma);

    this.guessCommands = new GuessCommands(prisma, guessService, guessBonusService);
    this.scheduleService = new ScheduleService(prisma);
  }

  // Bonus Hunt Commands
  async startHunt(ctx: TelegramContext) {
    try {
      const game = await this.bonusService.startGame();

      logGameEvent('bonus_hunt_started', {
        gameId: game.id,
        userId: ctx.user!.id,
      });

      await ctx.reply(
        `🎯 **Bonus Hunt Started!**\n\n` +
          `Game ID: \`${game.id}\`\n` +
          `Status: ${game.status}\n\n` +
          `Use /add_bonus to add bonuses during the hunt.\n` +
          `Use /open_bonus to record payouts during opening.\n` +
          `Use /close_hunt to finish and compute results.`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error('Failed to start hunt:', error);
      await ctx.reply('❌ Failed to start bonus hunt');
    }
  }

  async addBonus(ctx: TelegramContext) {
    const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];

    if (args.length === 0) {
      await ctx.reply('❌ Usage: /add_bonus <BonusName>');
      return;
    }

    const bonusName = args.join(' ').trim();

    if (bonusName.length > 50) {
      await ctx.reply('❌ Bonus name too long (max 50 characters)');
      return;
    }

    try {
      const bonus = await this.bonusService.addBonus(bonusName);

      logGameEvent('bonus_added', {
        gameId: bonus.gameId,
        bonusName,
        userId: ctx.user!.id,
      });

      await ctx.reply(`✅ Added bonus: **${bonusName}**`, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Failed to add bonus:', error);
      await ctx.reply('❌ Failed to add bonus');
    }
  }

  async openBonus(ctx: TelegramContext) {
    const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];

    if (args.length < 2) {
      await ctx.reply('❌ Usage: /open_bonus <BonusName> <AmountX>');
      return;
    }

    const bonusName = args.slice(0, -1).join(' ').trim();
    const amountX = parseInt(args[args.length - 1], 10);

    if (isNaN(amountX) || amountX < 0) {
      await ctx.reply('❌ Invalid amount. Must be a positive number.');
      return;
    }

    try {
      const payout = await this.bonusService.recordPayout(bonusName, amountX);

      logGameEvent('bonus_payout_recorded', {
        gameId: payout.gameId,
        bonusName,
        amountX,
        userId: ctx.user!.id,
      });

      await ctx.reply(
        `💰 **${bonusName}**: ${amountX}x\n\n` +
          `Use /close_hunt to finish and compute final results.`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error('Failed to record payout:', error);
      await ctx.reply('❌ Failed to record payout');
    }
  }

  async closeHunt(ctx: TelegramContext) {
    try {
      const result = await this.bonusService.closeGame();

      logGameEvent('bonus_hunt_closed', {
        gameId: result.game.id,
        totalPayout: result.totalPayout,
        entriesCount: result.entries.length,
        userId: ctx.user!.id,
      });

      let message = `🏁 **Bonus Hunt Complete!**\n\n`;
      message += `Total Payout: **${result.totalPayout}x**\n`;
      message += `Entries: ${result.entries.length}\n\n`;
      message += `**Top 10 Results:**\n`;

      result.entries.slice(0, 10).forEach((entry, index) => {
        const delta = Math.abs(entry.guess - result.totalPayout);
        const medal =
          index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        message += `${medal} ${entry.user.kickName || entry.user.telegramUser || 'Unknown'}: ${
          entry.guess
        } (Δ${delta})\n`;
      });

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Failed to close hunt:', error);
      await ctx.reply('❌ Failed to close bonus hunt');
    }
  }

  // Trivia Commands
  async startTrivia(ctx: TelegramContext) {
    try {
      const game = await this.triviaService.startGame();

      logGameEvent('trivia_started', {
        gameId: game.id,
        userId: ctx.user!.id,
      });

      await ctx.reply(
        `🧠 **Trivia Game Started!**\n\n` +
          `Game ID: \`${game.id}\`\n` +
          `Status: ${game.status}\n\n` +
          `Use /q to post questions.\n` +
          `Use /lock_round to stop accepting answers.\n` +
          `Use /stop_trivia to end the game.`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error('Failed to start trivia:', error);
      await ctx.reply('❌ Failed to start trivia game');
    }
  }

  async postQuestion(ctx: TelegramContext) {
    const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];

    if (args.length === 0) {
      await ctx.reply('❌ Usage: /q <Question> | <Answer>');
      return;
    }

    const text = args.join(' ');
    const parts = text.split('|');

    if (parts.length !== 2) {
      await ctx.reply('❌ Usage: /q <Question> | <Answer>');
      return;
    }

    const question = parts[0].trim();
    const answer = parts[1].trim();

    if (question.length > 500 || answer.length > 100) {
      await ctx.reply('❌ Question or answer too long');
      return;
    }

    try {
      const round = await this.triviaService.createRound(question, answer);

      logGameEvent('trivia_question_posted', {
        gameId: round.gameId,
        roundId: round.id,
        question,
        userId: ctx.user!.id,
      });

      await ctx.reply(
        `❓ **Question Posted!**\n\n` +
          `Question: ${question}\n` +
          `Round ID: \`${round.id}\`\n\n` +
          `Use /lock_round to stop accepting answers.`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error('Failed to post question:', error);
      await ctx.reply('❌ Failed to post question');
    }
  }

  async lockRound(ctx: TelegramContext) {
    try {
      const result = await this.triviaService.lockRound();

      logGameEvent('trivia_round_locked', {
        gameId: result.gameId,
        roundId: result.roundId,
        correctAnswers: result.correctAnswers.length,
        userId: ctx.user!.id,
      });

      let message = `🔒 **Round Locked!**\n\n`;
      message += `Correct answers: ${result.correctAnswers.length}\n\n`;

      if (result.correctAnswers.length > 0) {
        message += `**Correct answers:**\n`;
        result.correctAnswers.forEach((answer, index) => {
          message += `${index + 1}. ${
            answer.user.kickName || answer.user.telegramUser || 'Unknown'
          }\n`;
        });
      }

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Failed to lock round:', error);
      await ctx.reply('❌ Failed to lock round');
    }
  }

  async stopTrivia(ctx: TelegramContext) {
    try {
      const result = await this.triviaService.stopGame();

      logGameEvent('trivia_stopped', {
        gameId: result.game.id,
        totalRounds: result.totalRounds,
        userId: ctx.user!.id,
      });

      let message = `🏁 **Trivia Game Complete!**\n\n`;
      message += `Total rounds: ${result.totalRounds}\n\n`;
      message += `**Final Scores:**\n`;

      result.scores.slice(0, 10).forEach((score, index) => {
        const medal =
          index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        message += `${medal} ${score.user.kickName || score.user.telegramUser || 'Unknown'}: ${
          score.points
        } points\n`;
      });

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Failed to stop trivia:', error);
      await ctx.reply('❌ Failed to stop trivia game');
    }
  }

  // Utility Commands
  async showState(ctx: TelegramContext) {
    try {
      const currentGame = await this.prisma.game.findFirst({
        where: {
          status: {
            in: ['RUNNING', 'OPENING'],
          },
        },
        include: {
          bonusEntries: {
            include: {
              user: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
          payouts: true,
          triviaRounds: {
            where: {
              status: 'OPEN',
            },
            include: {
              answers: {
                include: {
                  user: true,
                },
              },
            },
          },
          scores: {
            include: {
              user: true,
            },
            orderBy: {
              points: 'desc',
            },
            take: 10,
          },
        },
      });

      if (!currentGame) {
        await ctx.reply('📊 No active game');
        return;
      }

      let message = `📊 **Current Game State**\n\n`;
      message += `Type: ${currentGame.type}\n`;
      message += `Status: ${currentGame.status}\n`;
      message += `Started: ${currentGame.startedAt?.toLocaleString()}\n\n`;

      if (currentGame.type === 'BONUS') {
        message += `**Bonus Entries:** ${currentGame.bonusEntries.length}\n`;
        message += `**Payouts:** ${currentGame.payouts.length}\n`;

        if (currentGame.payouts.length > 0) {
          const totalPayout = currentGame.payouts.reduce((sum, p) => sum + p.amountX, 0);
          message += `**Total Payout:** ${totalPayout}x\n`;
        }
      } else if (currentGame.type === 'TRIVIA') {
        message += `**Active Rounds:** ${currentGame.triviaRounds.length}\n`;
        message += `**Top Scores:**\n`;

        currentGame.scores.slice(0, 5).forEach((score, index) => {
          message += `${index + 1}. ${
            score.user.kickName || score.user.telegramUser || 'Unknown'
          }: ${score.points}\n`;
        });
      }

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Failed to show state:', error);
      await ctx.reply('❌ Failed to get game state');
    }
  }

  async resetGame(ctx: TelegramContext) {
    try {
      await this.prisma.game.updateMany({
        where: {
          status: {
            in: ['RUNNING', 'OPENING'],
          },
        },
        data: {
          status: 'IDLE',
          endedAt: new Date(),
        },
      });

      logUserAction('game_reset', ctx.user!.id);

      await ctx.reply('🔄 Game reset successfully');
    } catch (error) {
      logger.error('Failed to reset game:', error);
      await ctx.reply('❌ Failed to reset game');
    }
  }

  async payoutPreview(ctx: TelegramContext) {
    try {
      const preview = await this.payoutService.generatePayoutPreview();

      if (!preview) {
        await ctx.reply('❌ No completed game found for payout');
        return;
      }

      // Send DM to treasurer
      const treasurerIds = env.TREASURER_TELEGRAM_IDS;

      for (const treasurerId of treasurerIds) {
        try {
          await ctx.telegram.sendMessage(
            treasurerId,
            `💰 **Payout Instructions**\n\n` +
              `Game: ${preview.gameId}\n` +
              `Total winners: ${preview.winners.length}\n\n` +
              `**Tip Commands:**\n` +
              preview.tipCommands.join('\n'),
            { parse_mode: 'Markdown' }
          );
        } catch (error) {
          logger.error(`Failed to send payout preview to treasurer ${treasurerId}:`, error);
        }
      }

      // Post summary in payout group
      await ctx.telegram.sendMessage(
        env.TELEGRAM_PAYOUT_GROUP_ID,
        `🎉 **Payout Complete!**\n\n` +
          `Game: ${preview.gameId}\n` +
          `Winners: ${preview.winners.length}\n\n` +
          `Payout instructions sent to treasurer.`,
        { parse_mode: 'Markdown' }
      );

      await ctx.reply('✅ Payout preview sent to treasurer');
    } catch (error) {
      logger.error('Failed to generate payout preview:', error);
      await ctx.reply('❌ Failed to generate payout preview');
    }
  }

  async linkStatus(ctx: TelegramContext) {
    const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];

    if (args.length === 0) {
      await ctx.reply('❌ Usage: /link_status @username');
      return;
    }

    const username = args[0].replace('@', '');

    try {
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [{ telegramUser: username }, { kickName: username }],
        },
      });

      if (!user) {
        await ctx.reply('❌ User not found');
        return;
      }

      let message = `👤 **User Status**\n\n`;
      message += `ID: \`${user.id}\`\n`;
      message += `Role: ${user.role}\n`;
      message += `Telegram: ${user.telegramUser || 'Not linked'}\n`;
      message += `Kick: ${user.kickName || 'Not linked'}\n`;
      message += `Cwallet: ${user.cwalletHandle || 'Not linked'}\n`;
      message += `Linked: ${user.linkedAt ? user.linkedAt.toLocaleString() : 'No'}\n`;

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Failed to get link status:', error);
      await ctx.reply('❌ Failed to get user status');
    }
  }

  // Viewer Commands
  async linkAccount(ctx: TelegramContext) {
    try {
      const code = await this.linkService.generateLinkCode(ctx.user!.id);

      logUserAction('link_code_generated', ctx.user!.id, { code });

      await ctx.reply(
        `🔗 **Account Linking**\n\n` +
          `Your linking code: \`${code}\`\n\n` +
          `Go to Kick chat and type:\n` +
          `\`!link ${code}\`\n\n` +
          `This code expires in 10 minutes.`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error('Failed to generate link code:', error);
      await ctx.reply('❌ Failed to generate link code');
    }
  }

  async unlinkAccount(ctx: TelegramContext) {
    try {
      await this.linkService.unlinkAccount(ctx.user!.id);

      logUserAction('account_unlinked', ctx.user!.id);

      await ctx.reply('✅ Account unlinked successfully');
    } catch (error) {
      logger.error('Failed to unlink account:', error);
      await ctx.reply('❌ Failed to unlink account');
    }
  }

  // Guess Game Commands
  async guess(ctx: TelegramContext) {
    const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];

    await this.guessCommands.handleGuess(ctx, args);
  }

  async gtBalance(ctx: TelegramContext) {
    const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];

    await this.guessCommands.handleGtBalance(ctx, args);
  }

  async gtBonus(ctx: TelegramContext) {
    const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];

    await this.guessCommands.handleGtBonus(ctx, args);
  }

  // Admin Commands
  async balanceAdmin(ctx: TelegramContext) {
    const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];

    await this.guessCommands.handleBalanceAdmin(ctx, args);
  }

  async bonusAdmin(ctx: TelegramContext) {
    const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];

    await this.guessCommands.handleBonusAdmin(ctx, args);
  }

  async gameAdmin(ctx: TelegramContext) {
    const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];

    await this.guessCommands.handleGameAdmin(ctx, args);
  }

  // Admin Management Commands (OWNER only)
  async setRole(ctx: TelegramContext) {
    const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];

    try {
      // Check if user is OWNER
      if (ctx.user?.role !== 'OWNER') {
        await ctx.reply('⛔️ Owner only.');
        return;
      }

      if (args.length < 2) {
        await ctx.reply(
          '🔧 **Set User Role**\n\n' +
            'Usage: `/setrole <telegram_id> <MOD|OWNER>`\n\n' +
            'Example: `/setrole 123456789 MOD`\n' +
            'Example: `/setrole 123456789 OWNER`',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const telegramId = args[0];
      const role = args[1].toUpperCase();

      if (!['MOD', 'OWNER'].includes(role)) {
        await ctx.reply('❌ Role must be either MOD or OWNER.');
        return;
      }

      // Check if user exists
      const existingUser = await this.prisma.user.findUnique({
        where: { telegramId },
      });

      if (!existingUser) {
        await ctx.reply(
          `❌ User with Telegram ID ${telegramId} not found.\n\n` +
            'Make sure the user has used /start or /kick command first.',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Update user role
      const updatedUser = await this.prisma.user.update({
        where: { telegramId },
        data: { role },
      });

      await ctx.reply(
        `✅ **Role Updated Successfully**\n\n` +
          `User: ${updatedUser.telegramUser || 'Unknown'} (${updatedUser.telegramId})\n` +
          `Kick: ${updatedUser.kickName || 'Not linked'}\n` +
          `Role: ${updatedUser.role}`,
        { parse_mode: 'Markdown' }
      );

      logUserAction('role_updated', ctx.user.id, {
        targetUserId: updatedUser.id,
        targetTelegramId: telegramId,
        newRole: role,
        previousRole: existingUser.role,
      });
    } catch (error) {
      logger.error('Failed to set role:', error);
      await ctx.reply('❌ Failed to set role');
    }
  }

  async listUsers(ctx: TelegramContext) {
    const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];

    try {
      // Check if user is MOD or OWNER
      if (!['MOD', 'OWNER'].includes(ctx.user?.role || '')) {
        await ctx.reply('⛔️ Mods only.');
        return;
      }

      const limit = args.length > 0 ? Math.min(parseInt(args[0]) || 20, 50) : 20;

      const users = await this.prisma.user.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          telegramId: true,
          telegramUser: true,
          kickName: true,
          role: true,
          linkedAt: true,
          createdAt: true,
        },
      });

      if (users.length === 0) {
        await ctx.reply('📋 No users found.');
        return;
      }

      let message = `📋 **Users (${users.length}):**\n\n`;

      users.forEach((user, index) => {
        const roleEmoji = user.role === 'OWNER' ? '👑' : user.role === 'MOD' ? '🛡️' : '👤';
        const linkedStatus = user.kickName ? '✅' : '❌';

        message += `${index + 1}) ${roleEmoji} ${user.telegramUser || 'Unknown'}\n`;
        message += `   ID: \`${user.telegramId}\`\n`;
        message += `   Role: ${user.role}\n`;
        message += `   Kick: ${linkedStatus} ${user.kickName || 'Not linked'}\n`;
        message += `   Joined: ${user.createdAt.toLocaleDateString()}\n\n`;
      });

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Failed to list users:', error);
      await ctx.reply('❌ Failed to list users');
    }
  }

  // Schedule Commands
  async showSchedule(ctx: TelegramContext) {
    try {
      const schedules = await this.scheduleService.getScheduleForWeek();
      const message = this.scheduleService.formatScheduleForDisplay(schedules);
      
      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Failed to show schedule:', error);
      await ctx.reply('❌ Failed to get schedule');
    }
  }

  async addScheduleEntry(ctx: TelegramContext) {
    const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];

    if (args.length < 3) {
      await ctx.reply(
        '❌ Usage: /schedule add <day> <stream> <title>\n\n' +
        'Days: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday\n' +
        'Streams: 1=8am UTC, 2=6pm UTC\n\n' +
        'Example: /schedule add 1 1 "Monday Morning Stream"'
      );
      return;
    }

    const dayOfWeek = parseInt(args[0]);
    const streamNumber = parseInt(args[1]);
    const eventTitle = args.slice(2).join(' ');

    if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      await ctx.reply('❌ Day must be a number between 0 (Sunday) and 6 (Saturday)');
      return;
    }

    if (isNaN(streamNumber) || streamNumber < 1 || streamNumber > 2) {
      await ctx.reply('❌ Stream must be 1 (8am UTC) or 2 (6pm UTC)');
      return;
    }

    try {
      const schedule = await this.scheduleService.addScheduleEntry(
        dayOfWeek,
        streamNumber,
        eventTitle,
        ctx.user!.id
      );

      const streamTime = await this.scheduleService.getStreamTime(streamNumber);
      const timeStr = `${streamTime.hour.toString().padStart(2, '0')}:${streamTime.minute.toString().padStart(2, '0')} ${streamTime.timezone}`;
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      await ctx.reply(
        `✅ **Schedule Entry Added**\n\n` +
        `Day: ${days[dayOfWeek]}\n` +
        `Time: ${timeStr}\n` +
        `Title: ${eventTitle}`,
        { parse_mode: 'Markdown' }
      );

      logUserAction('schedule_entry_added', ctx.user!.id, {
        dayOfWeek,
        streamNumber,
        eventTitle
      });
    } catch (error) {
      logger.error('Failed to add schedule entry:', error);
      await ctx.reply('❌ Failed to add schedule entry');
    }
  }

  async removeScheduleEntry(ctx: TelegramContext) {
    const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];

    if (args.length < 2) {
      await ctx.reply(
        '❌ Usage: /schedule remove <day> <stream>\n\n' +
        'Days: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday\n' +
        'Streams: 1=8am UTC, 2=6pm UTC\n\n' +
        'Example: /schedule remove 1 1'
      );
      return;
    }

    const dayOfWeek = parseInt(args[0]);
    const streamNumber = parseInt(args[1]);

    if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      await ctx.reply('❌ Day must be a number between 0 (Sunday) and 6 (Saturday)');
      return;
    }

    if (isNaN(streamNumber) || streamNumber < 1 || streamNumber > 2) {
      await ctx.reply('❌ Stream must be 1 (8am UTC) or 2 (6pm UTC)');
      return;
    }

    try {
      await this.scheduleService.removeScheduleEntry(dayOfWeek, streamNumber);

      const streamTime = await this.scheduleService.getStreamTime(streamNumber);
      const timeStr = `${streamTime.hour.toString().padStart(2, '0')}:${streamTime.minute.toString().padStart(2, '0')} ${streamTime.timezone}`;
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      await ctx.reply(
        `✅ **Schedule Entry Removed**\n\n` +
        `Day: ${days[dayOfWeek]}\n` +
        `Time: ${timeStr}`,
        { parse_mode: 'Markdown' }
      );

      logUserAction('schedule_entry_removed', ctx.user!.id, {
        dayOfWeek,
        streamNumber
      });
    } catch (error) {
      logger.error('Failed to remove schedule entry:', error);
      await ctx.reply('❌ Failed to remove schedule entry');
    }
  }
}
