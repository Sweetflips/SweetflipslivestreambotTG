const viewerHelp = `🤖 <b>SweetflipsStreamBot Commands</b>\n\n` +
    `🎮 <b>Gaming Commands:</b>\n` +
    `/guess balance &lt;number&gt; - Guess the end balance (requires linked Kick account)\n` +
    `/guess bonus &lt;number&gt; - Guess the bonus total (requires linked Kick account)\n` +
    `/balanceboard - View live balance leaderboard\n` +
    `/bonusboard - View active bonus leaderboard\n\n` +
    `📅 <b>Schedule Commands:</b>\n` +
    `/schedule - View stream schedule for next 7 days\n\n` +
    `🔗 <b>Account Commands:</b>\n` +
    `/start - Welcome message and setup\n` +
    `/help - Show this help\n` +
    `/kick - Link your Kick account (one-time setup)`;
const adminHelp = viewerHelp +
    `\n\n⚙️ <b>Admin Commands:</b>\n` +
    `/balance open|close|finalize|reset|show - Manage balance game\n` +
    `/bonus open|close|finalize|reset|show - Manage bonus game\n` +
    `/add &lt;bonus&gt; - Add a bonus entry\n` +
    `/remove &lt;bonus&gt; - Remove a bonus entry\n` +
    `/live - Send live announcement to all groups\n` +
    `/broadcastschedule - Send schedule to all groups\n` +
    `/findgroups - Discover group chats\n` +
    `/groupstats - Group statistics\n` +
    `/testgroups - Validate group detection\n` +
    `/addgroup - Manually add group ID\n` +
    `/schedule add/remove - Manage schedule entries\n` +
    `/setrole &lt;telegram_id&gt; &lt;MOD|OWNER&gt; - Set user role\n` +
    `/listusers - List all users`;
export const createHelpCommand = () => async (ctx) => {
    if (!ctx.from) {
        return;
    }
    const user = await ctx.dependencies.users.getUserOrCreate(ctx.from.id, ctx.from.username);
    const message = ctx.dependencies.users.isAdmin(user)
        ? adminHelp
        : viewerHelp;
    await ctx.reply(message, { parse_mode: "HTML" });
};
