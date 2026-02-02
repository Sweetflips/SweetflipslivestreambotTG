import { createBot } from "./bot";
import { createHelpCommand } from "./commands/help";
import { createKickCommand } from "./commands/kick";
import { createReelCommand } from "./commands/reel";
import { createStartCommand } from "./commands/start";
import { handleKickLinking } from "./handlers/accountLinking";
import { createGoogleSheetsService } from "./services/googleSheets";
import { createLiveBalanceService } from "./services/liveBalanceService";
import { createPrismaClient } from "./services/prismaClient";
import { createUserService } from "./services/userService";
import { createInitialState } from "./state/botState";

const bootstrap = async () => {
  const [prisma, sheets] = await Promise.all([
    Promise.resolve(createPrismaClient()),
    createGoogleSheetsService(),
  ]);

  const liveBalance = createLiveBalanceService();
  const state = createInitialState();

  const users = createUserService(prisma, sheets);
  const bot = createBot({ prisma, sheets, liveBalance, state, users });

  bot.start(createStartCommand());
  bot.help(createHelpCommand());
  bot.command("kick", createKickCommand());
  bot.command("reel", createReelCommand());
  bot.on("text", handleKickLinking);

  await bot.launch();
  console.info("Bot launched");
};

bootstrap().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Failed to start bot: ${message}`);
  process.exitCode = 1;
});
