import type { PrismaClient } from "@prisma/client";
import type { Context } from "telegraf";
import type { GoogleSheetsService } from "./services/googleSheets";
import type { LiveBalanceService } from "./services/liveBalanceService";
import type { UserService } from "./services/userService";
import type { BotState } from "./state/botState";

export interface BotDependencies {
  prisma: PrismaClient | null;
  sheets: GoogleSheetsService | null;
  liveBalance: LiveBalanceService;
  state: BotState;
  users: UserService;
}

export interface BotContext extends Context {
  dependencies: BotDependencies;
}
