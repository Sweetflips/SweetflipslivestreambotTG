import { Telegraf } from "telegraf";
import { env } from "./config/environment";
import type { BotContext, BotDependencies } from "./dependencies";

export const createBot = (dependencies: BotDependencies) =>
  new Telegraf<BotContext>(env.TELEGRAM_BOT_TOKEN, {
    contextType: (initialContext) => ({
      ...initialContext,
      dependencies,
    }),
  });
