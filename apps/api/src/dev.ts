// Simple development server for testing
import { createServer } from 'http';

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });

  if (req.url === '/healthz') {
    res.end(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'SweetflipsStreamBot is running in development mode!'
    }));
  } else if (req.url === '/state') {
    res.end(JSON.stringify({
      gameType: null,
      gameStatus: 'IDLE',
      data: null,
      message: 'No active games'
    }));
  } else {
    res.end(JSON.stringify({
      message: 'SweetflipsStreamBot Development Server',
      endpoints: [
        'GET /healthz - Health check',
        'GET /state - Game state',
        'GET /overlay/state - Overlay state'
      ]
    }));
  }
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 SweetflipsStreamBot Development Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/healthz`);
  console.log(`🎮 Game state: http://localhost:${PORT}/state`);
  console.log(`📺 Overlay: http://localhost:${PORT}/overlay/state`);
});

