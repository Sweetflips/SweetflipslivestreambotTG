import { Telegraf } from "telegraf";
import { env } from "./config/environment";
export const createBot = (dependencies) => new Telegraf(env.TELEGRAM_BOT_TOKEN, {
    contextType: (initialContext) => ({
        ...initialContext,
        dependencies,
    }),
});
