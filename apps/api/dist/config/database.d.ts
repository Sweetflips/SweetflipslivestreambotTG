import { prisma } from '../lib/prisma.js';
export declare const connectDatabase: () => Promise<void>;
export declare const disconnectDatabase: () => Promise<void>;
export declare const checkDatabaseHealth: () => Promise<boolean>;
export { prisma };
//# sourceMappingURL=database.d.ts.map