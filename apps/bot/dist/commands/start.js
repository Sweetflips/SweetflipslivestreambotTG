export const createStartCommand = () => async (ctx) => {
    if (!ctx.from) {
        return;
    }
    const user = await ctx.dependencies.users.getUserOrCreate(ctx.from.id, ctx.from.username);
    const message = `🎉 Welcome to SweetflipsStreamBot!\n\n` +
        `You are: ${user.telegramUser ?? "Unknown"} (${user.telegramId})\n` +
        `Role: ${user.role}\n\n` +
        `🎮 <b>Gaming Commands:</b>\n` +
        `/guess balance &lt;number&gt; - Guess the end balance\n` +
        `/guess bonus &lt;number&gt; - Guess the bonus total\n` +
        `/balanceboard - View balance leaderboard\n` +
        `/bonusboard - View bonus leaderboard\n\n` +
        `🔗 <b>Account Commands:</b>\n` +
        `/kick - Link your Kick account\n` +
        `/help - Show all commands\n\n` +
        `Ready to play? Link your Kick account first with /kick!`;
    await ctx.reply(message, { parse_mode: "HTML" });
};
