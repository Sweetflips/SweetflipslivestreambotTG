# SweetflipsStreamBot API

The core API server for the SweetflipsStreamBot application.

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

## 📁 Project Structure

```
src/
├── config/              # Environment configuration
│   └── env.ts          # Zod schema validation
├── telemetry/          # Logging and monitoring
│   └── logger.ts       # Pino logger setup
├── auth/               # Authentication and RBAC
│   └── rbac.ts         # Role-based access control
├── utils/              # Shared utilities
│   ├── errors.ts       # Custom error classes
│   ├── regex.ts        # Input parsing and validation
│   └── rateLimit.ts    # Redis rate limiting
├── modules/            # Feature modules
│   ├── telegram/       # Telegram bot integration
│   │   ├── telegramBot.ts
│   │   ├── commands.ts
│   │   └── middlewares.ts
│   ├── kick/           # Kick chat integration
│   │   ├── chatProvider.ts
│   │   ├── wsProvider.ts
│   │   └── messageParsers.ts
│   ├── games/          # Game logic
│   │   ├── bonus/      # Bonus hunt game
│   │   └── trivia/     # Trivia game
│   ├── payouts/        # Payout management
│   │   ├── cwallet.ts
│   │   ├── tipTemplates.ts
│   │   └── payoutService.ts
│   ├── linking/        # Account linking
│   │   ├── linkService.ts
│   │   └── linkController.ts
│   └── overlay/        # WebSocket overlay
│       ├── dto.ts
│       └── ws.ts
├── prisma/             # Database
│   └── schema.prisma   # Database schema
├── test/               # Tests
│   ├── setup.ts
│   ├── unit/
│   └── integration/
├── index.ts            # Application entry point
├── server.ts           # Fastify server setup
└── routes.ts           # API routes
```

## 🔧 Configuration

### Environment Variables

Copy `env.example` to `.env` and configure:

```env
# Server
NODE_ENV=development
PORT=8080
PUBLIC_BASE_URL=https://localhost:8080

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_MOD_GROUP_ID=-1001234567890
TELEGRAM_PAYOUT_GROUP_ID=-1009876543210
TELEGRAM_WEBHOOK_SECRET=randomstring

# Kick
KICK_CHANNEL=your_channel
KICK_PROVIDER=ws
KICK_WS_URL=wss://example.kick.chat

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sweetflips

# Redis
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your_jwt_secret
```

## 🎮 API Endpoints

### Health & Status
- `GET /healthz` - Health check
- `GET /state` - Current game state
- `GET /api/health` - Detailed health status

### Games
- `POST /api/games/bonus/start` - Start bonus hunt
- `POST /api/games/bonus/add-bonus` - Add bonus
- `POST /api/games/bonus/record-payout` - Record payout
- `POST /api/games/bonus/close` - Close bonus hunt
- `GET /api/games/bonus/leaderboard` - Get leaderboard

### Trivia
- `POST /api/games/trivia/start` - Start trivia
- `POST /api/games/trivia/create-round` - Create round
- `POST /api/games/trivia/lock-round` - Lock round
- `POST /api/games/trivia/stop` - Stop trivia

### Account Linking
- `POST /api/link/generate-code` - Generate link code
- `POST /api/link/verify` - Verify link code
- `GET /api/link/status/:userId` - Get link status

### Overlay
- `GET /api/overlay/state` - Overlay state
- `GET /api/overlay/connections` - Active connections

### Webhooks
- `POST /webhooks/telegram/webhook` - Telegram webhook
- `POST /webhooks/kick/webhook` - Kick webhook

## 🧪 Testing

### Unit Tests
```bash
pnpm test
```

### Integration Tests
```bash
pnpm test:integration
```

### Coverage
```bash
pnpm test:coverage
```

## 🐳 Docker

### Build
```bash
docker build -t sweetflips/api .
```

### Run
```bash
docker run -p 8080:8080 -p 8081:8081 --env-file .env sweetflips/api
```

## 📊 Monitoring

### Logs
Structured JSON logs with Pino:
```json
{
  "level": "info",
  "time": "2023-12-01T10:00:00.000Z",
  "type": "game_event",
  "event": "bonus_hunt_started",
  "gameId": "clp123...",
  "userId": "clp456..."
}
```

### Metrics
- Request/response times
- Error rates
- Database query performance
- Redis cache hit rates
- WebSocket connections

## 🔒 Security

### Rate Limiting
- Redis-based token bucket
- Per-user and per-endpoint limits
- Configurable windows and limits

### Input Validation
- Zod schema validation
- SQL injection protection
- XSS prevention
- Command injection protection

### Authentication
- Telegram admin verification
- JWT tokens for API access
- Role-based permissions
- Secure webhook validation

## 🚀 Deployment

### Development
```bash
pnpm dev
```

### Production
```bash
pnpm build
pnpm start
```

### Docker
```bash
docker-compose up -d
```

## 📝 Development Guidelines

1. **TypeScript**: Use strict mode and proper typing
2. **Testing**: Write tests for new features
3. **Logging**: Use structured logging with context
4. **Error Handling**: Use custom error classes
5. **Documentation**: Update API documentation
6. **Performance**: Monitor and optimize queries
7. **Security**: Validate all inputs and sanitize outputs

