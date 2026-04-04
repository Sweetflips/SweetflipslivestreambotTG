import { createPrismaClient as createPrisma } from "../lib/prisma.js";
export const createPrismaClient = () => {
    return createPrisma();
};
