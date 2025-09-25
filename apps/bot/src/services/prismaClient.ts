import { PrismaClient } from "@prisma/client";

export const createPrismaClient = (): PrismaClient | null => {
  try {
    const client = new PrismaClient();
    console.info("Database connection initialized");
    return client;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Prisma error";
    console.error(`Database initialization failed: ${message}`);
    return null;
  }
};
