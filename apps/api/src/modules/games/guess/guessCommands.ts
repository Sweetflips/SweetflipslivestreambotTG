import { GameType, PrismaClient } from '@prisma/client';
import { Context } from 'telegraf';
import { NotFoundError } from '../../utils/errors';
import { BonusService } from './bonusService';
import { GuessService } from './guessService';

export class GuessCommands {
  constructor(
    private prisma: PrismaClient,
    private guessService: GuessService,
    private bonusService: BonusService
  ) {}

  // Check if user is linked to Kick
  private async isUserLinked(telegramId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { telegramId },
      select: { kickName: true },
    });

    return !!user?.kickName;
  }

  // Get user by Telegram ID
  private async getUser(telegramId: string) {
    const user = await this.prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      throw new NotFoundError('User not found. Please use /start to register.');
    }

    return user;
  }

  // Handle /gtbalance command
  async handleGtBalance(ctx: Context, args: string[]): Promise<void> {
    try {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) {
        await ctx.reply('❌ Unable to identify user.');
        return;
      }

      // Check if user is linked
      if (!(await this.isUserLinked(telegramId))) {
        await ctx.reply(
          '🔗 **Account Linking Required**\n\n' +
            'You must link your Kick account before participating in games.\n\n' +
            'Use /kick to link your account.',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const user = await this.getUser(telegramId);

      // If no number provided, prompt for input
      if (args.length === 0) {
        await ctx.reply(
          '🎯 **Guess the Balance**\n\n' +
            'Send your balance guess now (one time).\n\n' +
            'Example: `/gtbalance 50000`',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Parse and validate number
      const guess = parseInt(args[0]);
      if (isNaN(guess)) {
        await ctx.reply('❌ Please provide a valid number.');
        return;
      }

      // Submit guess
      const result = await this.guessService.submitGuess(user.id, GameType.GUESS_BALANCE, guess);

      await ctx.reply(result.message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error in handleGtBalance:', error);
      await ctx.reply('❌ An error occurred. Please try again.');
    }
  }

  // Handle /gtbonus command
  async handleGtBonus(ctx: Context, args: string[]): Promise<void> {
    try {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) {
        await ctx.reply('❌ Unable to identify user.');
        return;
      }

      // Check if user is linked
      if (!(await this.isUserLinked(telegramId))) {
        await ctx.reply(
          '🔗 **Account Linking Required**\n\n' +
            'You must link your Kick account before participating in games.\n\n' +
            'Use /kick to link your account.',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const user = await this.getUser(telegramId);

      // If no number provided, prompt for input
      if (args.length === 0) {
        await ctx.reply(
          '🎯 **Guess the Bonus Total**\n\n' +
            'Send your bonus total guess now (one time).\n\n' +
            'Example: `/gtbonus 150`',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Parse and validate number
      const guess = parseInt(args[0]);
      if (isNaN(guess)) {
        await ctx.reply('❌ Please provide a valid number.');
        return;
      }

      // Submit guess
      const result = await this.guessService.submitGuess(user.id, GameType.GUESS_BONUS, guess);

      await ctx.reply(result.message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error in handleGtBonus:', error);
      await ctx.reply('❌ An error occurred. Please try again.');
    }
  }

  // Handle /balance admin commands
  async handleBalanceAdmin(ctx: Context, args: string[]): Promise<void> {
    try {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) {
        await ctx.reply('❌ Unable to identify user.');
        return;
      }

      // Check admin permissions
      if (!(await this.guessService.isAdmin(telegramId))) {
        await ctx.reply('⛔️ Mods only.');
        await this.logAuditAttempt(telegramId, 'balance_admin', args);
        return;
      }

      const user = await this.getUser(telegramId);

      if (args.length === 0) {
        await ctx.reply(
          '🔧 **Balance Admin Commands**\n\n' +
            'Available commands:\n' +
            '• `/balance open` - Open guessing\n' +
            '• `/balance close` - Close guessing\n' +
            '• `/balance final <number>` - Set final value\n' +
            '• `/balance reveal [top=<n>]` - Reveal results\n' +
            '• `/balance show [top=<n>]` - Show standings\n' +
            '• `/balance reset` - Reset game (OWNER only)\n' +
            '• `/balance export` - Export guesses\n' +
            '• `/balance grace <seconds>` - Set edit window\n' +
            '• `/balance window <minutes>` - Set auto-close\n' +
            '• `/balance range <min> <max>` - Set range (OWNER only)',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const command = args[0].toLowerCase();

      switch (command) {
        case 'open':
          const openResult = await this.guessService.openRound(GameType.GUESS_BALANCE, user.id);
          await ctx.reply(openResult, { parse_mode: 'Markdown' });
          break;

        case 'close':
          const closeResult = await this.guessService.closeRound(GameType.GUESS_BALANCE, user.id);
          await ctx.reply(closeResult, { parse_mode: 'Markdown' });
          break;

        case 'final':
          if (args.length < 2) {
            await ctx.reply('❌ Usage: `/balance final <number>`', { parse_mode: 'Markdown' });
            return;
          }
          const finalValue = parseInt(args[1]);
          if (isNaN(finalValue)) {
            await ctx.reply('❌ Please provide a valid number.');
            return;
          }
          const finalResult = await this.guessService.setFinalValue(
            GameType.GUESS_BALANCE,
            finalValue,
            user.id
          );
          await ctx.reply(finalResult, { parse_mode: 'Markdown' });
          break;

        case 'reveal':
          const topN = this.parseTopN(args);
          const revealResult = await this.guessService.revealResults(
            GameType.GUESS_BALANCE,
            user.id,
            topN
          );
          await ctx.reply(revealResult, { parse_mode: 'Markdown' });
          break;

        case 'show':
          const showTopN = this.parseTopN(args);
          const showResult = await this.guessService.showStandings(
            GameType.GUESS_BALANCE,
            showTopN
          );
          await ctx.reply(showResult, { parse_mode: 'Markdown' });
          break;

        case 'reset':
          if (!(await this.guessService.isOwner(telegramId))) {
            await ctx.reply('⛔️ Owner only.');
            return;
          }
          if (args.length < 2 || args[1] !== 'CONFIRM') {
            await ctx.reply(
              '⚠️ **Reset Confirmation Required**\n\nThis will clear all guesses and results.\n\nUse `/balance reset CONFIRM` to proceed.',
              { parse_mode: 'Markdown' }
            );
            return;
          }
          const resetResult = await this.guessService.resetRound(GameType.GUESS_BALANCE, user.id);
          await ctx.reply(resetResult, { parse_mode: 'Markdown' });
          break;

        case 'export':
          const exportResult = await this.guessService.exportGuesses(GameType.GUESS_BALANCE);
          await ctx.reply(`📊 **Balance Guesses Export:**\n\n\`\`\`csv\n${exportResult}\n\`\`\``, {
            parse_mode: 'Markdown',
          });
          break;

        case 'grace':
          if (args.length < 2) {
            await ctx.reply('❌ Usage: `/balance grace <seconds>`', { parse_mode: 'Markdown' });
            return;
          }
          const graceSeconds = parseInt(args[1]);
          if (isNaN(graceSeconds) || graceSeconds < 0) {
            await ctx.reply('❌ Please provide a valid number of seconds (≥0).');
            return;
          }
          const graceResult = await this.guessService.updateConfig(
            GameType.GUESS_BALANCE,
            { graceWindow: graceSeconds },
            user.id
          );
          await ctx.reply(graceResult, { parse_mode: 'Markdown' });
          break;

        case 'window':
          if (args.length < 2) {
            await ctx.reply('❌ Usage: `/balance window <minutes>`', { parse_mode: 'Markdown' });
            return;
          }
          const windowMinutes = parseInt(args[1]);
          if (isNaN(windowMinutes) || windowMinutes < 0) {
            await ctx.reply('❌ Please provide a valid number of minutes (≥0).');
            return;
          }
          const windowResult = await this.guessService.updateConfig(
            GameType.GUESS_BALANCE,
            { windowMin: windowMinutes },
            user.id
          );
          await ctx.reply(windowResult, { parse_mode: 'Markdown' });
          break;

        case 'range':
          if (!(await this.guessService.isOwner(telegramId))) {
            await ctx.reply('⛔️ Owner only.');
            return;
          }
          if (args.length < 3) {
            await ctx.reply('❌ Usage: `/balance range <min> <max>`', { parse_mode: 'Markdown' });
            return;
          }
          const minRange = parseInt(args[1]);
          const maxRange = parseInt(args[2]);
          if (isNaN(minRange) || isNaN(maxRange) || minRange >= maxRange) {
            await ctx.reply('❌ Please provide valid min and max values (min < max).');
            return;
          }
          const rangeResult = await this.guessService.updateConfig(
            GameType.GUESS_BALANCE,
            { minRange, maxRange },
            user.id
          );
          await ctx.reply(rangeResult, { parse_mode: 'Markdown' });
          break;

        default:
          await ctx.reply('❌ Unknown balance command. Use `/balance` to see available commands.', {
            parse_mode: 'Markdown',
          });
      }
    } catch (error) {
      console.error('Error in handleBalanceAdmin:', error);
      await ctx.reply('❌ An error occurred. Please try again.');
    }
  }

  // Handle /bonus admin commands
  async handleBonusAdmin(ctx: Context, args: string[]): Promise<void> {
    try {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) {
        await ctx.reply('❌ Unable to identify user.');
        return;
      }

      // Check admin permissions
      if (!(await this.guessService.isAdmin(telegramId))) {
        await ctx.reply('⛔️ Mods only.');
        await this.logAuditAttempt(telegramId, 'bonus_admin', args);
        return;
      }

      const user = await this.getUser(telegramId);

      if (args.length === 0) {
        await ctx.reply(
          '🔧 **Bonus Admin Commands**\n\n' +
            'Available commands:\n' +
            '• `/bonus open` - Open guessing\n' +
            '• `/bonus close` - Close guessing\n' +
            '• `/bonus final <number>` - Set final value directly\n' +
            '• `/bonus reveal [top=<n>]` - Reveal results\n' +
            '• `/bonus show [top=<n>]` - Show standings\n' +
            '• `/bonus reset` - Reset game (OWNER only)\n' +
            '• `/bonus export` - Export guesses\n' +
            '• `/bonus grace <seconds>` - Set edit window\n' +
            '• `/bonus window <minutes>` - Set auto-close\n' +
            '• `/bonus range <min> <max>` - Set range (OWNER only)\n\n' +
            '**Bonus Item Management:**\n' +
            '• `/bonus add <name>` - Add bonus item\n' +
            '• `/bonus remove <name>` - Remove bonus item\n' +
            '• `/bonus list` - List bonus items\n' +
            '• `/bonus payout <name> <x>` - Record payout\n' +
            '• `/bonus finalize` - Calculate total from items',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const command = args[0].toLowerCase();

      switch (command) {
        case 'open':
          const openResult = await this.guessService.openRound(GameType.GUESS_BONUS, user.id);
          await ctx.reply(openResult, { parse_mode: 'Markdown' });
          break;

        case 'close':
          const closeResult = await this.guessService.closeRound(GameType.GUESS_BONUS, user.id);
          await ctx.reply(closeResult, { parse_mode: 'Markdown' });
          break;

        case 'final':
          if (args.length < 2) {
            await ctx.reply('❌ Usage: `/bonus final <number>`', { parse_mode: 'Markdown' });
            return;
          }
          const finalValue = parseInt(args[1]);
          if (isNaN(finalValue)) {
            await ctx.reply('❌ Please provide a valid number.');
            return;
          }
          const finalResult = await this.guessService.setFinalValue(
            GameType.GUESS_BONUS,
            finalValue,
            user.id
          );
          await ctx.reply(finalResult, { parse_mode: 'Markdown' });
          break;

        case 'reveal':
          const topN = this.parseTopN(args);
          const revealResult = await this.guessService.revealResults(
            GameType.GUESS_BONUS,
            user.id,
            topN
          );
          await ctx.reply(revealResult, { parse_mode: 'Markdown' });
          break;

        case 'show':
          const showTopN = this.parseTopN(args);
          const showResult = await this.guessService.showStandings(GameType.GUESS_BONUS, showTopN);
          await ctx.reply(showResult, { parse_mode: 'Markdown' });
          break;

        case 'reset':
          if (!(await this.guessService.isOwner(telegramId))) {
            await ctx.reply('⛔️ Owner only.');
            return;
          }
          if (args.length < 2 || args[1] !== 'CONFIRM') {
            await ctx.reply(
              '⚠️ **Reset Confirmation Required**\n\nThis will clear all guesses and results.\n\nUse `/bonus reset CONFIRM` to proceed.',
              { parse_mode: 'Markdown' }
            );
            return;
          }
          const resetResult = await this.guessService.resetRound(GameType.GUESS_BONUS, user.id);
          await ctx.reply(resetResult, { parse_mode: 'Markdown' });
          break;

        case 'export':
          const exportResult = await this.guessService.exportGuesses(GameType.GUESS_BONUS);
          await ctx.reply(`📊 **Bonus Guesses Export:**\n\n\`\`\`csv\n${exportResult}\n\`\`\``, {
            parse_mode: 'Markdown',
          });
          break;

        case 'grace':
          if (args.length < 2) {
            await ctx.reply('❌ Usage: `/bonus grace <seconds>`', { parse_mode: 'Markdown' });
            return;
          }
          const graceSeconds = parseInt(args[1]);
          if (isNaN(graceSeconds) || graceSeconds < 0) {
            await ctx.reply('❌ Please provide a valid number of seconds (≥0).');
            return;
          }
          const graceResult = await this.guessService.updateConfig(
            GameType.GUESS_BONUS,
            { graceWindow: graceSeconds },
            user.id
          );
          await ctx.reply(graceResult, { parse_mode: 'Markdown' });
          break;

        case 'window':
          if (args.length < 2) {
            await ctx.reply('❌ Usage: `/bonus window <minutes>`', { parse_mode: 'Markdown' });
            return;
          }
          const windowMinutes = parseInt(args[1]);
          if (isNaN(windowMinutes) || windowMinutes < 0) {
            await ctx.reply('❌ Please provide a valid number of minutes (≥0).');
            return;
          }
          const windowResult = await this.guessService.updateConfig(
            GameType.GUESS_BONUS,
            { windowMin: windowMinutes },
            user.id
          );
          await ctx.reply(windowResult, { parse_mode: 'Markdown' });
          break;

        case 'range':
          if (!(await this.guessService.isOwner(telegramId))) {
            await ctx.reply('⛔️ Owner only.');
            return;
          }
          if (args.length < 3) {
            await ctx.reply('❌ Usage: `/bonus range <min> <max>`', { parse_mode: 'Markdown' });
            return;
          }
          const minRange = parseInt(args[1]);
          const maxRange = parseInt(args[2]);
          if (isNaN(minRange) || isNaN(maxRange) || minRange >= maxRange) {
            await ctx.reply('❌ Please provide valid min and max values (min < max).');
            return;
          }
          const rangeResult = await this.guessService.updateConfig(
            GameType.GUESS_BONUS,
            { minRange, maxRange },
            user.id
          );
          await ctx.reply(rangeResult, { parse_mode: 'Markdown' });
          break;

        // Bonus item management
        case 'add':
          if (args.length < 2) {
            await ctx.reply('❌ Usage: `/bonus add <name>`', { parse_mode: 'Markdown' });
            return;
          }
          const addResult = await this.bonusService.addBonusItem(args.slice(1).join(' '), user.id);
          await ctx.reply(addResult, { parse_mode: 'Markdown' });
          break;

        case 'remove':
          if (args.length < 2) {
            await ctx.reply('❌ Usage: `/bonus remove <name>`', { parse_mode: 'Markdown' });
            return;
          }
          const removeResult = await this.bonusService.removeBonusItem(
            args.slice(1).join(' '),
            user.id
          );
          await ctx.reply(removeResult, { parse_mode: 'Markdown' });
          break;

        case 'list':
          const listResult = await this.bonusService.listBonusItems();
          await ctx.reply(listResult, { parse_mode: 'Markdown' });
          break;

        case 'payout':
          if (args.length < 3) {
            await ctx.reply('❌ Usage: `/bonus payout <name> <x>`', { parse_mode: 'Markdown' });
            return;
          }
          const payoutX = parseInt(args[args.length - 1]);
          if (isNaN(payoutX)) {
            await ctx.reply('❌ Please provide a valid payout multiplier.');
            return;
          }
          const name = args.slice(1, -1).join(' ');
          const payoutResult = await this.bonusService.recordPayout(name, payoutX, user.id);
          await ctx.reply(payoutResult, { parse_mode: 'Markdown' });
          break;

        case 'finalize':
          const finalizeResult = await this.bonusService.finalizeBonusTotal(user.id);
          await ctx.reply(finalizeResult, { parse_mode: 'Markdown' });
          break;

        default:
          await ctx.reply('❌ Unknown bonus command. Use `/bonus` to see available commands.', {
            parse_mode: 'Markdown',
          });
      }
    } catch (error) {
      console.error('Error in handleBonusAdmin:', error);
      await ctx.reply('❌ An error occurred. Please try again.');
    }
  }

  // Handle /game admin commands (aliases)
  async handleGameAdmin(ctx: Context, args: string[]): Promise<void> {
    try {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) {
        await ctx.reply('❌ Unable to identify user.');
        return;
      }

      // Check admin permissions
      if (!(await this.guessService.isAdmin(telegramId))) {
        await ctx.reply('⛔️ Mods only.');
        await this.logAuditAttempt(telegramId, 'game_admin', args);
        return;
      }

      if (args.length < 2) {
        await ctx.reply(
          '🔧 **Game Admin Commands**\n\n' +
            'Available commands:\n' +
            '• `/game open <bonus|balance>` - Open guessing\n' +
            '• `/game close <bonus|balance>` - Close guessing\n' +
            '• `/game reset <bonus|balance>` - Reset game (OWNER only)\n' +
            '• `/game show <bonus|balance> [top=<n>]` - Show standings\n' +
            '• `/game export <bonus|balance>` - Export guesses',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const gameType = args[0].toLowerCase();
      const command = args[1].toLowerCase();
      const remainingArgs = args.slice(2);

      if (gameType !== 'bonus' && gameType !== 'balance') {
        await ctx.reply('❌ Game type must be "bonus" or "balance".');
        return;
      }

      const actualGameType = gameType === 'bonus' ? GameType.GUESS_BONUS : GameType.GUESS_BALANCE;
      const user = await this.getUser(telegramId);

      switch (command) {
        case 'open':
          const openResult = await this.guessService.openRound(actualGameType, user.id);
          await ctx.reply(openResult, { parse_mode: 'Markdown' });
          break;

        case 'close':
          const closeResult = await this.guessService.closeRound(actualGameType, user.id);
          await ctx.reply(closeResult, { parse_mode: 'Markdown' });
          break;

        case 'reset':
          if (!(await this.guessService.isOwner(telegramId))) {
            await ctx.reply('⛔️ Owner only.');
            return;
          }
          if (remainingArgs.length === 0 || remainingArgs[0] !== 'CONFIRM') {
            await ctx.reply(
              `⚠️ **Reset Confirmation Required**\n\nThis will clear all guesses and results.\n\nUse \`/game reset ${gameType} CONFIRM\` to proceed.`,
              { parse_mode: 'Markdown' }
            );
            return;
          }
          const resetResult = await this.guessService.resetRound(actualGameType, user.id);
          await ctx.reply(resetResult, { parse_mode: 'Markdown' });
          break;

        case 'show':
          const showTopN = this.parseTopN(remainingArgs);
          const showResult = await this.guessService.showStandings(actualGameType, showTopN);
          await ctx.reply(showResult, { parse_mode: 'Markdown' });
          break;

        case 'export':
          const exportResult = await this.guessService.exportGuesses(actualGameType);
          const gameName = gameType === 'bonus' ? 'Bonus' : 'Balance';
          await ctx.reply(
            `📊 **${gameName} Guesses Export:**\n\n\`\`\`csv\n${exportResult}\n\`\`\``,
            { parse_mode: 'Markdown' }
          );
          break;

        default:
          await ctx.reply('❌ Unknown game command. Use `/game` to see available commands.', {
            parse_mode: 'Markdown',
          });
      }
    } catch (error) {
      console.error('Error in handleGameAdmin:', error);
      await ctx.reply('❌ An error occurred. Please try again.');
    }
  }

  // Parse top=N parameter
  private parseTopN(args: string[]): number {
    const topArg = args.find(arg => arg.startsWith('top='));
    if (topArg) {
      const topN = parseInt(topArg.split('=')[1]);
      return isNaN(topN) ? 10 : Math.max(1, Math.min(50, topN)); // Clamp between 1-50
    }
    return 10; // Default
  }

  // Log audit attempt for unauthorized access
  private async logAuditAttempt(
    telegramId: string,
    command: string,
    args: string[]
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: telegramId,
          command: `unauthorized_${command}`,
          params: JSON.stringify({ args, attemptedBy: telegramId }),
        },
      });
    } catch (error) {
      console.error('Failed to log audit attempt:', error);
    }
  }
}
