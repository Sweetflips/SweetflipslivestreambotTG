import { Telegraf } from "telegraf";
import { env } from "./config/environment";
export const createBot = (dependencies) => {
    const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);
    bot.use((ctx, next) => {
        ctx.dependencies = dependencies;
        return next();
    });
    return bot;
};
