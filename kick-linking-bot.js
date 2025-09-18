// Telegram Bot with Kick Account Linking
const https = require('https');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = '8422817933:AAHm0YU707fnBeuehr-QrFJD-4A9M6aTCPc';
const BOT_USERNAME = '@sweetflipsstreambot';

// Admin Telegram IDs (add your admin IDs here)
const ADMIN_IDS = ['7638759103']; // Your Telegram ID from the logs

// Database file
const DB_FILE = 'accounts.json';

let lastUpdateId = 0;
let accounts = {};
let pendingKickLinks = {}; // Store pending kick username links

// Load database
function loadDatabase() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            accounts = JSON.parse(data);
            console.log(`📊 Loaded ${Object.keys(accounts).length} linked accounts`);
        }
    } catch (error) {
        console.error('❌ Error loading database:', error);
        accounts = {};
    }
}

// Save database
function saveDatabase() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(accounts, null, 2));
        console.log('💾 Database saved');
    } catch (error) {
        console.error('❌ Error saving database:', error);
    }
}

// Check if user is admin
function isAdmin(telegramId) {
    return ADMIN_IDS.includes(telegramId.toString());
}

// Send message to Telegram
function sendMessage(chatId, text, replyToMessageId = null) {
    const data = JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        reply_to_message_id: replyToMessageId
    });

    const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${BOT_TOKEN}/sendMessage`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };

    const req = https.request(options, (res) => {
        console.log(`📤 Sent response to chat ${chatId}`);
    });

    req.on('error', (error) => {
        console.error('❌ Error sending message:', error);
    });

    req.write(data);
    req.end();
}

// Command handlers
const commands = {
    '/start': (chatId, username, firstName) => {
        const kickUsername = accounts[chatId]?.kickUsername;
        const status = kickUsername ? `✅ Linked to Kick: <b>@${kickUsername}</b>` : '❌ Not linked to Kick';

        return `🎮 <b>Welcome to SweetflipsStreamBot!</b>

I'm your interactive gaming companion for Sweetflips streams!

🔗 <b>Account Status:</b>
${status}

🎯 <b>Available Commands:</b>
/kick <username> - Link your Kick account
/help - Show all commands
/gtbonus - Guess the total bonuses (when activated)
/gtbalance - Guess the end balance (when activated)
/trivia - Submit trivia answers during stream

Use /help to see all available commands!`;
    },

    '/help': (chatId, username, firstName) => {
        const kickUsername = accounts[chatId]?.kickUsername;
        const status = kickUsername ? `✅ Linked to Kick: <b>@${kickUsername}</b>` : '❌ Not linked to Kick';

        return `🤖 <b>SweetflipsStreamBot Commands</b>

🔗 <b>Account Status:</b>
${status}

🎮 <b>Available to Everyone:</b>
/start - Welcome message & account status
/help - Show this help
/kick <username> - Link your Kick account (one-time only)

🎯 <b>Stream Games (Admin Activated):</b>
/gtbonus - Submit ONE guess for total bonuses Sweetflips will collect
/gtbalance - Submit ONE guess for Sweetflips' end balance
/trivia - Submit trivia answers during stream

📊 <b>How it works:</b>
• Use /kick to link your Kick username
• Admins activate games before stream starts
• You can only submit ONE guess per game
• Leaderboards show who's closest to the actual amounts
• Winners get rewards after the stream!

${isAdmin(chatId) ? '\n🔧 <b>Admin Commands:</b>\n/unlink <telegram_id> - Unlink a user\'s Kick account' : ''}`;
    },

    '/kick': (chatId, username, firstName, args) => {
        // Check if already linked
        if (accounts[chatId]) {
            return `❌ <b>Already Linked!</b>

You are already linked to Kick account: <b>@${accounts[chatId].kickUsername}</b>

Only admins can unlink accounts. Contact an admin if you need to change your linked account.`;
        }
        
        // Start the linking process
        pendingKickLinks[chatId] = {
            telegramId: chatId,
            telegramUsername: username,
            firstName: firstName,
            startedAt: new Date().toISOString()
        };
        
        return `🔗 <b>Link Your Kick Account</b>

Please now go ahead and send your personal Kick username. This will be linked to your Telegram account.

<b>Instructions:</b>
• Simply type your Kick username (without @)
• Example: <code>sweetflips</code>
• You can only link ONE Kick account per Telegram account

⏰ <i>This link request will expire in 5 minutes.</i>`;
    },

    '/unlink': (chatId, username, firstName, args) => {
        // Check if user is admin
        if (!isAdmin(chatId)) {
            return `❌ <b>Access Denied</b>

Only admins can unlink accounts.`;
        }

        // Check if target user ID provided
        if (!args || args.length === 0) {
            return `🔧 <b>Admin: Unlink Account</b>

Usage: <code>/unlink <telegram_id></code>

Example: <code>/unlink 123456789</code>

This will unlink the specified user's Kick account.`;
        }

        const targetTelegramId = args[0];

        if (!accounts[targetTelegramId]) {
            return `❌ <b>User Not Found</b>

No linked account found for Telegram ID: <code>${targetTelegramId}</code>`;
        }

        const kickUsername = accounts[targetTelegramId].kickUsername;
        delete accounts[targetTelegramId];
        saveDatabase();

        return `✅ <b>Account Unlinked</b>

Successfully unlinked Telegram ID <code>${targetTelegramId}</code> from Kick account <b>@${kickUsername}</b>`;
    },

    '/gtbonus': (chatId, username, firstName) => {
        const kickUsername = accounts[chatId]?.kickUsername;
        const status = kickUsername ? `Linked to: <b>@${kickUsername}</b>` : '❌ <b>Not linked to Kick</b>';

        return `🎯 <b>Guess the Bonuses Game</b>

${status}

This game is currently <b>INACTIVE</b> ❌

When an admin activates this game, you'll be able to:
• Submit ONE guess for total bonuses Sweetflips collects
• See live leaderboard during stream
• Win rewards if you're closest!

⏰ Check back when the stream starts!`;
    },

    '/gtbalance': (chatId, username, firstName) => {
        const kickUsername = accounts[chatId]?.kickUsername;
        const status = kickUsername ? `Linked to: <b>@${kickUsername}</b>` : '❌ <b>Not linked to Kick</b>';

        return `💰 <b>Guess the Balance Game</b>

${status}

This game is currently <b>INACTIVE</b> ❌

When an admin activates this game, you'll be able to:
• Submit ONE guess for Sweetflips' end balance
• See live leaderboard during stream
• Win rewards if you're closest!

⏰ Check back when the stream starts!`;
    },

    '/trivia': (chatId, username, firstName) => {
        const kickUsername = accounts[chatId]?.kickUsername;
        const status = kickUsername ? `Linked to: <b>@${kickUsername}</b>` : '❌ <b>Not linked to Kick</b>';

        return `🧠 <b>Trivia Game</b>

${status}

This game is currently <b>INACTIVE</b> ❌

When trivia is active during stream, you'll be able to:
• Submit answers to trivia questions
• Earn points for correct answers
• Compete on the live leaderboard

⏰ Check back during the stream!`;
    }
};

// Get updates from Telegram
function getUpdates() {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;

    https.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            try {
                const response = JSON.parse(data);

                if (response.ok && response.result.length > 0) {
                    response.result.forEach(update => {
                        lastUpdateId = update.update_id;

                        if (update.message) {
                            const chatId = update.message.chat.id;
                            const text = update.message.text;
                            const username = update.message.from.username;
                            const firstName = update.message.from.first_name;

                            console.log(`📨 Received: "${text}" from @${username || firstName} (${chatId})`);

                            // Check if user is in pending kick link mode
                            if (pendingKickLinks[chatId]) {
                                // Check if link request is expired (5 minutes)
                                const linkRequest = pendingKickLinks[chatId];
                                const now = new Date();
                                const requestTime = new Date(linkRequest.startedAt);
                                const timeDiff = (now - requestTime) / 1000 / 60; // minutes
                                
                                if (timeDiff > 5) {
                                    // Expired
                                    delete pendingKickLinks[chatId];
                                    sendMessage(chatId, `⏰ <b>Link Request Expired</b>\n\nYour Kick account linking request has expired. Please use /kick to start again.`);
                                    return;
                                }
                                
                                // Process the kick username
                                const kickUsername = text.replace('@', '').toLowerCase().trim();
                                
                                // Validate username (basic validation)
                                if (!kickUsername || kickUsername.length < 2 || kickUsername.length > 20) {
                                    sendMessage(chatId, `❌ <b>Invalid Username</b>\n\nPlease enter a valid Kick username (2-20 characters).\n\nExample: <code>sweetflips</code>`);
                                    return;
                                }
                                
                                // Check if kick username is already taken
                                const existingLink = Object.values(accounts).find(acc => acc.kickUsername === kickUsername);
                                if (existingLink) {
                                    delete pendingKickLinks[chatId];
                                    sendMessage(chatId, `❌ <b>Kick Username Already Linked!</b>\n\nThe Kick username <b>@${kickUsername}</b> is already linked to another Telegram account.\n\nPlease contact an admin if you believe this is an error.`);
                                    return;
                                }
                                
                                // Link the account
                                accounts[chatId] = {
                                    telegramId: chatId,
                                    telegramUsername: username,
                                    firstName: firstName,
                                    kickUsername: kickUsername,
                                    linkedAt: new Date().toISOString()
                                };
                                
                                delete pendingKickLinks[chatId];
                                saveDatabase();
                                
                                sendMessage(chatId, `✅ <b>Account Linked Successfully!</b>\n\nYour Telegram account is now linked to Kick: <b>@${kickUsername}</b>\n\nYou can now participate in:\n• 🎯 Bonus guessing games\n• 🧠 Trivia challenges\n• 💰 Reward distributions\n\nUse /help to see all available commands!`);
                                return;
                            }
                            
                            // Parse command and arguments
                            const parts = text.split(' ');
                            const command = parts[0];
                            const args = parts.slice(1);
                            
                            // Handle commands
                            if (commands[command]) {
                                const response = commands[command](chatId, username, firstName, args);
                                sendMessage(chatId, response);
                            } else {
                                sendMessage(chatId, `🤖 I received: "${text}"\n\nUse /help to see available commands!`);
                            }
                        }
                    });
                }

                // Continue polling
                setTimeout(getUpdates, 1000);

            } catch (error) {
                console.error('❌ Error parsing updates:', error);
                setTimeout(getUpdates, 5000);
            }
        });
    }).on('error', (error) => {
        console.error('❌ Error getting updates:', error);
        setTimeout(getUpdates, 5000);
    });
}

// Start the bot
console.log('🤖 Starting SweetflipsStreamBot with Kick Linking');
console.log('================================================');
console.log(`Bot: ${BOT_USERNAME}`);
console.log(`Admins: ${ADMIN_IDS.join(', ')}`);
console.log('Mode: Polling with database');
console.log('');

loadDatabase();
getUpdates();
