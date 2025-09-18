# Sweetflips Livestream Bot (Telegram)

A comprehensive Telegram bot for Sweetflips livestream gaming features including balance and bonus guessing games with live leaderboards.

## Features

### 🎮 Gaming Commands
- **Balance Guessing**: Users can guess the end balance with live leaderboard
- **Bonus Guessing**: Users can guess the total bonus amount with live leaderboard
- **Prize System**: Top 3 guessers win prizes ($12.50, $7.50, $5.00)
- **Live Balance Integration**: Real-time balance fetching from external API

### 🔗 Account Management
- **Kick Account Linking**: One-time linking of Telegram to Kick accounts
- **Google Sheets Integration**: Automatic syncing of linked accounts
- **Role-Based Access Control**: VIEWER, MOD, OWNER roles

### ⚙️ Admin Features
- **Game Management**: Open/close/finalize/reset games
- **Bonus Management**: Add/remove individual bonuses
- **User Management**: Set roles, list users
- **Live Leaderboards**: Real-time standings with prizes

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/SweetflipslivestreambotTG.git
   cd SweetflipslivestreambotTG
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   Edit `.env` with your configuration:
   - `TELEGRAM_BOT_TOKEN`: Your Telegram bot token from @BotFather
   - `LIVE_BALANCE_BEARER_TOKEN`: Bearer token for live balance API
   - `GOOGLE_SPREADSHEET_ID`: Google Sheets ID for account syncing

4. **Set up Google Sheets API**
   - Create a Google Cloud Project
   - Enable Google Sheets API
   - Create a service account
   - Download the JSON key file
   - Place it in `credentials/google-service-account.json`
   - Share your Google Sheet with the service account email

5. **Set up database**
   ```bash
   npm run db:generate
   npm run db:push
   ```

6. **Start the bot**
   ```bash
   npm start
   ```

## Commands

### Viewer Commands
- `/start` - Welcome message and setup
- `/help` - Show available commands (role-based)
- `/kick` - Link your Kick account
- `/guess balance <number>` - Guess the end balance (private only)
- `/guess bonus <number>` - Guess the bonus total (private only)
- `/balanceboard` - View live balance leaderboard
- `/bonusboard` - View active bonus leaderboard

### Admin Commands (MOD/OWNER)
- `/balance open/close/finalize/reset/show` - Balance game management
- `/bonus open/close/finalize/reset/show` - Bonus game management
- `/add <bonus name>` - Add a bonus (counts as +1)
- `/remove <bonus name>` - Remove a bonus (counts as -1)
- `/setrole <telegram_id> <MOD|OWNER>` - Set user role (OWNER only)
- `/listusers` - List all users

## Game Flow

### Balance Game
1. Admin opens balance guessing with `/balance open`
2. Users submit guesses privately with `/guess balance <number>`
3. Admin closes guessing with `/balance close`
4. Admin finalizes with live balance using `/balance finalize`
5. Leaderboard shows final results with prizes

### Bonus Game
1. Admin adds bonuses with `/add <bonus name>`
2. Admin opens bonus guessing with `/bonus open`
3. Users submit guesses privately with `/guess bonus <number>`
4. Admin closes guessing with `/bonus close`
5. Admin finalizes with `/bonus finalize`
6. Leaderboard shows final results with prizes

## Prize Structure
- 🥇 **1st Place**: $12.50
- 🥈 **2nd Place**: $7.50
- 🥉 **3rd Place**: $5.00
- 🏅 **4th & 5th Place**: Recognition only

## Technical Details

### Database Schema
- **User**: Telegram ID, username, Kick name, role, timestamps
- **Guess**: User ID, game type, guess value, timestamps
- **AuditLog**: Action logging for admin commands

### API Integration
- **Live Balance API**: Real-time balance fetching with caching
- **Google Sheets API**: Account linking synchronization
- **Rate Limiting**: Built-in protection for external APIs

### Security Features
- **Role-Based Access Control**: Strict permission system
- **Private Commands**: Guessing commands restricted to private chats
- **Input Validation**: Comprehensive validation for all inputs
- **Error Handling**: Graceful error handling and fallbacks

## Development

### Scripts
- `npm start` - Start the bot
- `npm run dev` - Start with nodemon for development
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Create and run migrations

### Environment Variables
- `TELEGRAM_BOT_TOKEN` - Required: Telegram bot token
- `DATABASE_URL` - Required: Database connection string
- `LIVE_BALANCE_BEARER_TOKEN` - Required: API bearer token
- `GOOGLE_SPREADSHEET_ID` - Required: Google Sheets ID
- `NODE_ENV` - Optional: Environment (development/production)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support or questions, please contact the development team or create an issue in the repository.