import { Server } from './server.js';
import { logger } from './telemetry/logger.js';
const server = new Server();
// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await server.stop();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    await server.stop();
    process.exit(0);
});
// Start server
server.start().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map