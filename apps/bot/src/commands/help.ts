import type { MiddlewareFn } from "telegraf";
import type { BotContext } from "../dependencies";

const viewerHelp =
  `🤖 <b>SweetflipsStreamBot Commands</b>\n\n` +
  `🎮 <b>Gaming Commands:</b>\n` +
  `/guess balance &lt;number&gt; - Guess the end balance (requires linked Kick account)\n` +
  `/guess bonus &lt;number&gt; - Guess the bonus total (requires linked Kick account)\n` +
  `/balanceboard - View live balance leaderboard with top 5 guessers\n` +
  `/bonusboard - View active bonus leaderboard with top 5 guessers\n\n` +
  `📅 <b>Schedule Commands:</b>\n` +
  `/schedule - View stream schedule for next 7 days\n\n` +
  `🔗 <b>Account Commands:</b>\n` +
  `/start - Welcome message and setup\n` +
  `/help - Show this help\n` +
  `/kick - Link your Kick account (one-time setup)`;

const adminHelp =
  viewerHelp +
  `\n\n⚙️ <b>Admin Commands:</b>\n` +
  `/balance open - Open balance guessing\n` +
  `/balance close - Close balance guessing\n` +
  `/balance finalize - Finalize balance game with live balance\n` +
  `/balance reset - Reset balance game\n` +
  `/balance show - Show current balance standings\n\n` +
  `/bonus open - Open bonus guessing\n` +
  `/bonus close - Close bonus guessing\n` +
  `/bonus finalize - Finalize bonus game with active bonus\n` +
  `/bonus reset - Reset bonus game\n` +
  `/bonus show - Show current bonus standings\n\n` +
  `/game open &lt;bonus|balance&gt; - Open guessing (new)\n` +
  `/game close &lt;bonus|balance&gt; - Close guessing (new)\n` +
  `/game show &lt;bonus|balance&gt; - Show standings (new)\n` +
  `/game export &lt;bonus|balance&gt; - Export guesses (new)\n` +
  `/game complete &lt;bonus|balance&gt; - Complete and archive game (OWNER only)\n` +
  `/game new &lt;bonus|balance&gt; - Start new game round (OWNER only)\n` +
  `/game reset &lt;bonus|balance&gt; CONFIRM - Reset game (archives data) (OWNER only)\n` +
  `/game archive &lt;bonus|balance&gt; - View archived games (OWNER only)\n` +
  `/game stats &lt;bonus|balance&gt; - Show game statistics (OWNER only)\n` +
  `/game cleanup &lt;bonus|balance&gt; &lt;days&gt; - Clean old archives (OWNER only)\n\n` +
  `/add &lt;bonus name&gt; - Add a bonus (counts as +1)\n` +
  `/remove &lt;bonus name&gt; - Remove a bonus (counts as -1)\n\n` +
  `/live - Send live announcement to all groups\n` +
  `/broadcastschedule - Manually send schedule to all groups\n` +
  `/findgroups - Find all group chats where bot is a member\n` +
  `/groupstats - Show detailed group management statistics\n` +
  `/testgroups - Test group detection functionality\n` +
  `/addgroup - Manually add a group ID for live announcements\n\n` +
  `/schedule add &lt;day&gt; &lt;stream&gt; &lt;title&gt; - Add schedule entry\n` +
  `/schedule remove &lt;day&gt; &lt;stream&gt; - Remove schedule entry\n\n` +
  `/reel &lt;instagram_reel_url&gt; [views_qty] [likes_qty] - Order Instagram reel views and likes\n\n` +
  `/panelservices reel - Show detected panel service IDs for reel views/likes (OWNER only)\n` +
  `/setrole &lt;telegram_id&gt; &lt;MOD|OWNER&gt; - Set user role\n` +
  `/listusers - List all users`;

export const createHelpCommand =
  (): MiddlewareFn<BotContext> => async (ctx) => {
    if (!ctx.from) {
      return;
    }

    const user = await ctx.dependencies.users.getUserOrCreate(
      ctx.from.id,
      ctx.from.username
    );

    const message = ctx.dependencies.users.isAdmin(user)
      ? adminHelp
      : viewerHelp;
    await ctx.reply(message, { parse_mode: "HTML" });
  };
