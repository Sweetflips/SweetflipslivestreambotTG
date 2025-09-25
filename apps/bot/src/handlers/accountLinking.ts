import type { MiddlewareFn } from "telegraf";
import type { BotContext } from "../dependencies";

const isValidKickName = (value: string) => /^[a-zA-Z0-9_]{3,20}$/.test(value);

export const handleKickLinking: MiddlewareFn<BotContext> = async (ctx, next) => {
  if (!ctx.from) {
    await next();
    return;
  }

  const { dependencies } = ctx;

  if (!dependencies.state.linkingUsers.has(ctx.from.id)) {
    await next();
    return;
  }

  const kickName = ctx.message?.text?.trim() ?? "";

  if (!isValidKickName(kickName)) {
    await ctx.reply("Invalid Kick username. Use alphanumeric characters and underscores (3-20).");
    return;
  }

  const existing = await dependencies.users.findByKickName(kickName);

  if (existing) {
    await ctx.reply("This Kick username is already linked to another account.");
    dependencies.state.linkingUsers.delete(ctx.from.id);
    return;
  }

  const updated = await dependencies.users.setKickName(ctx.from.id, kickName);

  dependencies.state.linkingUsers.delete(ctx.from.id);

  if (!updated) {
    await ctx.reply("Database unavailable. Unable to link Kick account.");
    return;
  }

  await ctx.reply(
    `Account linked successfully. Telegram: @${updated.telegramUser ?? "unknown"}, Kick: @${kickName}`
  );
};

