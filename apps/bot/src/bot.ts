import { Telegraf } from "telegraf";
import { env } from "./config/environment";
import type { BotContext, BotDependencies } from "./dependencies";

export const createBot = (dependencies: BotDependencies) => {
  const bot = new Telegraf<BotContext>(env.TELEGRAM_BOT_TOKEN);
  
  bot.use((ctx, next) => {
    ctx.dependencies = dependencies;
    return next();
  });
  
  return bot;
};
