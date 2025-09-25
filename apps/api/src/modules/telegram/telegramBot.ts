import { PrismaClient } from '@prisma/client';
import { Telegraf } from 'telegraf';
import { AuthService, createRBACMiddleware } from '../../auth/rbac.js';
import { getEnv } from '../../config/env.js';
import { logger } from '../../telemetry/logger.js';
import { RATE_LIMITS, RateLimiter } from '../../utils/rateLimit.js';
import { BonusService } from '../games/bonus/bonusService.js';
import { TriviaService } from '../games/trivia/triviaService.js';
import { LinkService } from '../linking/linkService.js';
import { PayoutService } from '../payouts/payoutService.js';
import { TelegramCommands } from './commands.js';
import {
  TelegramContext,
  authMiddleware,
  commandValidationMiddleware,
  errorMiddleware,
  idempotencyMiddleware,
  loggingMiddleware,
  rateLimitMiddleware,
} from './middlewares.js';

const env = getEnv();

export class TelegramBot {
  private bot: Telegraf<TelegramContext>;
  private commands: TelegramCommands;

  constructor(private prisma: PrismaClient, private redis: any, private rateLimiter: RateLimiter) {
    this.bot = new Telegraf<TelegramContext>(env.TELEGRAM_BOT_TOKEN);

    // Initialize services
    const authService = new AuthService(prisma);
    const bonusService = new BonusService(prisma);
    const triviaService = new TriviaService(prisma);
    const payoutService = new PayoutService(prisma);
    const linkService = new LinkService(prisma);

    this.commands = new TelegramCommands(
      prisma,
      bonusService,
      triviaService,
      payoutService,
      linkService
    );

    this.setupMiddlewares(authService);
    this.setupCommands();
  }

  private setupMiddlewares(authService: AuthService) {
    // Add services to context
    this.bot.use((ctx, next) => {
      ctx.authService = authService;
      ctx.rateLimiter = this.rateLimiter;
      return next();
    });

    // Global middlewares
    this.bot.use(loggingMiddleware);
    this.bot.use(errorMiddleware);
    this.bot.use(commandValidationMiddleware);
    this.bot.use(idempotencyMiddleware);
    this.bot.use(authMiddleware);
  }

  private setupCommands() {
    // Mod commands (require MOD role)
    const modMiddleware = createRBACMiddleware('MOD' as any);
    const modRateLimit = rateLimitMiddleware(RATE_LIMITS.MOD_COMMAND);

    // Bonus Hunt Commands
    this.bot.command('start_hunt', modMiddleware, modRateLimit, ctx =>
      this.commands.startHunt(ctx)
    );
    this.bot.command('add_bonus', modMiddleware, modRateLimit, ctx => this.commands.addBonus(ctx));
    this.bot.command('open_bonus', modMiddleware, modRateLimit, ctx =>
      this.commands.openBonus(ctx)
    );
    this.bot.command('close_hunt', modMiddleware, modRateLimit, ctx =>
      this.commands.closeHunt(ctx)
    );

    // Trivia Commands
    this.bot.command('start_trivia', modMiddleware, modRateLimit, ctx =>
      this.commands.startTrivia(ctx)
    );
    this.bot.command('q', modMiddleware, modRateLimit, ctx => this.commands.postQuestion(ctx));
    this.bot.command('lock_round', modMiddleware, modRateLimit, ctx =>
      this.commands.lockRound(ctx)
    );
    this.bot.command('stop_trivia', modMiddleware, modRateLimit, ctx =>
      this.commands.stopTrivia(ctx)
    );

    // Utility Commands
    this.bot.command('state', modMiddleware, modRateLimit, ctx => this.commands.showState(ctx));
    this.bot.command('reset_game', modMiddleware, modRateLimit, ctx =>
      this.commands.resetGame(ctx)
    );
    this.bot.command('payout_preview', modMiddleware, modRateLimit, ctx =>
      this.commands.payoutPreview(ctx)
    );
    this.bot.command('link_status', modMiddleware, modRateLimit, ctx =>
      this.commands.linkStatus(ctx)
    );

    // Admin Management Commands (OWNER only)
    const ownerMiddleware = createRBACMiddleware('OWNER' as any);
    this.bot.command('setrole', ownerMiddleware, modRateLimit, ctx => this.commands.setRole(ctx));

    // Admin Management Commands (MOD or OWNER)
    this.bot.command('listusers', modMiddleware, modRateLimit, ctx => this.commands.listUsers(ctx));

    // Viewer commands (require VIEWER role)
    const viewerMiddleware = createRBACMiddleware('VIEWER' as any);
    const viewerRateLimit = rateLimitMiddleware(RATE_LIMITS.VIEWER_COMMAND);

    this.bot.command('link', viewerMiddleware, viewerRateLimit, ctx =>
      this.commands.linkAccount(ctx)
    );
    this.bot.command('unlink', viewerMiddleware, viewerRateLimit, ctx =>
      this.commands.unlinkAccount(ctx)
    );

    // Guess Game Commands (viewer commands)
    this.bot.command('guess', viewerMiddleware, viewerRateLimit, ctx =>
      this.commands.guess(ctx)
    );
    this.bot.command('gtbalance', viewerMiddleware, viewerRateLimit, ctx =>
      this.commands.gtBalance(ctx)
    );
    this.bot.command('gtbonus', viewerMiddleware, viewerRateLimit, ctx =>
      this.commands.gtBonus(ctx)
    );

    // Admin Guess Game Commands (require MOD role)
    this.bot.command('balance', modMiddleware, modRateLimit, ctx =>
      this.commands.balanceAdmin(ctx)
    );
    this.bot.command('bonus', modMiddleware, modRateLimit, ctx => this.commands.bonusAdmin(ctx));
    this.bot.command('game', modMiddleware, modRateLimit, ctx => this.commands.gameAdmin(ctx));

    // Help command (no auth required)
    this.bot.command('help', async ctx => {
      try {
        const helpText = `
🤖 **SweetflipsStreamBot Commands**

**🎮 Gaming Commands:**
/guess balance \\<number\\> - Guess the end balance (requires linked Kick account)
/guess bonus \\<number\\> - Guess the bonus total (requires linked Kick account)
/balanceboard - View live balance leaderboard with top 5 guessers
/bonusboard - View active bonus leaderboard with top 5 guessers

**📅 Schedule Commands:**
/schedule - View stream schedule for next 7 days

**🔗 Account Commands:**
/start - Welcome message and setup
/help - Show this help
/kick - Link your Kick account (one-time setup)

**⚙️ Admin Commands:**
/balance open - Open balance guessing
/balance close - Close balance guessing
/balance finalize - Finalize balance game with live balance
/balance reset - Reset balance game
/balance show - Show current balance standings

/bonus open - Open bonus guessing
/bonus close - Close bonus guessing
/bonus finalize - Finalize bonus game with active bonus
/bonus reset - Reset bonus game
/bonus show - Show current bonus standings

/game open \\<bonus\\|balance\\> - Open guessing (new)
/game close \\<bonus\\|balance\\> - Close guessing (new)
/game show \\<bonus\\|balance\\> - Show standings (new)
/game export \\<bonus\\|balance\\> - Export guesses (new)
/game complete \\<bonus\\|balance\\> - Complete and archive game (OWNER only)
/game new \\<bonus\\|balance\\> - Start new game round (OWNER only)
/game reset \\<bonus\\|balance\\> CONFIRM - Reset game (archives data) (OWNER only)
/game archive \\<bonus\\|balance\\> - View archived games (OWNER only)
/game stats \\<bonus\\|balance\\> - Show game statistics (OWNER only)
/game cleanup \\<bonus\\|balance\\> \\<days\\> - Clean old archives (OWNER only)

/add \\<bonus name\\> - Add a bonus (counts as +1)
/remove \\<bonus name\\> - Remove a bonus (counts as -1)

/live - Send live announcement to all groups
/broadcastschedule - Manually send schedule to all groups
/findgroups - Find all group chats where bot is a member
/groupstats - Show detailed group management statistics
/testgroups - Test group detection functionality
/addgroup - Manually add a group ID for live announcements

/schedule add \\<day\\> \\<stream\\> \\<title\\> - Add schedule entry
/schedule remove \\<day\\> \\<stream\\> - Remove schedule entry

/setrole \\<telegram_id\\> \\<MOD\\|OWNER\\> - Set user role
/listusers - List all users
        `;

        await ctx.reply(helpText, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error('Error in help command:', error);
        // Fallback to plain text if Markdown fails
        const fallbackText = `
🤖 SweetflipsStreamBot Commands

🎮 Gaming Commands:
/guess balance <number> - Guess the end balance (requires linked Kick account)
/guess bonus <number> - Guess the bonus total (requires linked Kick account)
/balanceboard - View live balance leaderboard with top 5 guessers
/bonusboard - View active bonus leaderboard with top 5 guessers

📅 Schedule Commands:
/schedule - View stream schedule for next 7 days

🔗 Account Commands:
/start - Welcome message and setup
/help - Show this help
/kick - Link your Kick account (one-time setup)

⚙️ Admin Commands:
/balance open - Open balance guessing
/balance close - Close balance guessing
/balance finalize - Finalize balance game with live balance
/balance reset - Reset balance game
/balance show - Show current balance standings

/bonus open - Open bonus guessing
/bonus close - Close bonus guessing
/bonus finalize - Finalize bonus game with active bonus
/bonus reset - Reset bonus game
/bonus show - Show current bonus standings

/game open <bonus|balance> - Open guessing (new)
/game close <bonus|balance> - Close guessing (new)
/game show <bonus|balance> - Show standings (new)
/game export <bonus|balance> - Export guesses (new)
/game complete <bonus|balance> - Complete and archive game (OWNER only)
/game new <bonus|balance> - Start new game round (OWNER only)
/game reset <bonus|balance> CONFIRM - Reset game (archives data) (OWNER only)
/game archive <bonus|balance> - View archived games (OWNER only)
/game stats <bonus|balance> - Show game statistics (OWNER only)
/game cleanup <bonus|balance> <days> - Clean old archives (OWNER only)

/add <bonus name> - Add a bonus (counts as +1)
/remove <bonus name> - Remove a bonus (counts as -1)

/live - Send live announcement to all groups
/broadcastschedule - Manually send schedule to all groups
/findgroups - Find all group chats where bot is a member
/groupstats - Show detailed group management statistics
/testgroups - Test group detection functionality
/addgroup - Manually add a group ID for live announcements

/schedule add <day> <stream> <title> - Add schedule entry
/schedule remove <day> <stream> - Remove schedule entry

/setrole <telegram_id> <MOD|OWNER> - Set user role
/listusers - List all users
        `;
        await ctx.reply(fallbackText);
      }
    });

    // Admin help command
    this.bot.command('help_admin', modMiddleware, async ctx => {
      try {
        const helpText = `
🔧 **Admin Commands Help**

**Balance Game Management:**
/balance open - Open balance guessing
/balance close - Close balance guessing
/balance final \\<number\\> - Set final balance value
/balance reveal [top=\\<n\\>] - Reveal results (default top 10)
/balance show [top=\\<n\\>] - Show current standings
/balance reset CONFIRM - Reset game (OWNER only)
/balance export - Export guesses as CSV
/balance grace \\<seconds\\> - Set edit window (default 30s)
/balance window \\<minutes\\> - Set auto-close timer (0 = manual)
/balance range \\<min\\> \\<max\\> - Set guess range (OWNER only)

**Bonus Game Management:**
/bonus open - Open bonus guessing
/bonus close - Close bonus guessing
/bonus final \\<number\\> - Set final bonus total directly
/bonus reveal [top=\\<n\\>] - Reveal results
/bonus show [top=\\<n\\>] - Show current standings
/bonus reset CONFIRM - Reset game (OWNER only)
/bonus export - Export guesses as CSV
/bonus grace \\<seconds\\> - Set edit window
/bonus window \\<minutes\\> - Set auto-close timer
/bonus range \\<min\\> \\<max\\> - Set guess range (OWNER only)

**Bonus Item Management:**
/bonus add \\<name\\> - Add bonus item
/bonus remove \\<name\\> - Remove bonus item
/bonus list - List all bonus items
/bonus payout \\<name\\> \\<x\\> - Record payout multiplier
/bonus finalize - Calculate total from items

**Generic Game Commands:**
/game open \\<bonus\\|balance\\> - Open guessing
/game close \\<bonus\\|balance\\> - Close guessing
/game reset \\<bonus\\|balance\\> CONFIRM - Reset game (OWNER only)
/game show \\<bonus\\|balance\\> [top=\\<n\\>] - Show standings
/game export \\<bonus\\|balance\\> - Export guesses

**Game Phases:** IDLE → OPEN → CLOSED → REVEALED
**Default Ranges:** Balance: 1-1,000,000 \\| Bonus: 1-9,999
**Grace Window:** 30 seconds for editing guesses
        `;

        await ctx.reply(helpText, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error('Error in help_admin command:', error);
        // Fallback to plain text if Markdown fails
        const fallbackText = `
🔧 Admin Commands Help

Balance Game Management:
/balance open - Open balance guessing
/balance close - Close balance guessing
/balance final <number> - Set final balance value
/balance reveal [top=<n>] - Reveal results (default top 10)
/balance show [top=<n>] - Show current standings
/balance reset CONFIRM - Reset game (OWNER only)
/balance export - Export guesses as CSV
/balance grace <seconds> - Set edit window (default 30s)
/balance window <minutes> - Set auto-close timer (0 = manual)
/balance range <min> <max> - Set guess range (OWNER only)

Bonus Game Management:
/bonus open - Open bonus guessing
/bonus close - Close bonus guessing
/bonus final <number> - Set final bonus total directly
/bonus reveal [top=<n>] - Reveal results
/bonus show [top=<n>] - Show current standings
/bonus reset CONFIRM - Reset game (OWNER only)
/bonus export - Export guesses as CSV
/bonus grace <seconds> - Set edit window
/bonus window <minutes> - Set auto-close timer
/bonus range <min> <max> - Set guess range (OWNER only)

Bonus Item Management:
/bonus add <name> - Add bonus item
/bonus remove <name> - Remove bonus item
/bonus list - List all bonus items
/bonus payout <name> <x> - Record payout multiplier
/bonus finalize - Calculate total from items

Generic Game Commands:
/game open <bonus|balance> - Open guessing
/game close <bonus|balance> - Close guessing
/game reset <bonus|balance> CONFIRM - Reset game (OWNER only)
/game show <bonus|balance> [top=<n>] - Show standings
/game export <bonus|balance> - Export guesses

Game Phases: IDLE → OPEN → CLOSED → REVEALED
Default Ranges: Balance: 1-1,000,000 | Bonus: 1-9,999
Grace Window: 30 seconds for editing guesses
        `;
        await ctx.reply(fallbackText);
      }
    });
  }

  async setupWebhook() {
    try {
      await this.bot.telegram.setWebhook(env.TELEGRAM_WEBHOOK_URL);
      logger.info('Telegram webhook set up successfully');
    } catch (error) {
      logger.error('Failed to set up Telegram webhook:', error);
      throw error;
    }
  }

  async removeWebhook() {
    try {
      await this.bot.telegram.deleteWebhook();
      logger.info('Telegram webhook removed successfully');
    } catch (error) {
      logger.error('Failed to remove Telegram webhook:', error);
      throw error;
    }
  }

  getWebhookHandler() {
    return this.bot.webhookCallback('/webhook/telegram');
  }

  async startPolling() {
    try {
      await this.bot.launch();
      logger.info('Telegram bot started in polling mode');
    } catch (error) {
      logger.error('Failed to start Telegram bot:', error);
      throw error;
    }
  }

  async stop() {
    try {
      await this.bot.stop();
      logger.info('Telegram bot stopped');
    } catch (error) {
      logger.error('Failed to stop Telegram bot:', error);
      throw error;
    }
  }
}
