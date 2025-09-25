import type { PrismaClient } from "@prisma/client";
import type { Context } from "telegraf";
import type { GoogleSheetsService } from "./services/googleSheets";
import type { LiveBalanceService } from "./services/liveBalanceService";
import type { BotState } from "./state/botState";
import type { UserService } from "./services/userService";

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

