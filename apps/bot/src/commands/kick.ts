import type { MiddlewareFn } from "telegraf";
import type { BotContext } from "../dependencies";

export const createKickCommand = (): MiddlewareFn<BotContext> => async (ctx) => {
  if (!ctx.from || ctx.chat?.type !== "private") {
    await ctx.reply("This command only works in private chat.");
    return;
  }

  const user = await ctx.dependencies.users.getUserOrCreate(ctx.from.id, ctx.from.username);

  if (user.kickName) {
    await ctx.reply(`Kick account already linked: @${user.kickName}`);
    return;
  }

  if (ctx.dependencies.state.linkingUsers.has(ctx.from.id)) {
    await ctx.reply("Send your Kick username now.");
    return;
  }

  ctx.dependencies.state.linkingUsers.add(ctx.from.id);
  await ctx.reply("Send your Kick username (without @).");
};

