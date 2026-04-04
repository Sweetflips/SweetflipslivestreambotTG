// Simple Telegram Bot Test with Polling (No Webhook Needed)
const https = require('https');

const BOT_TOKEN = '8422817933:AAHm0YU707fnBeuehr-QrFJD-4A9M6aTCPc';
const BOT_USERNAME = '@sweetflipsstreambot';

let lastUpdateId = 0;

// Simple command handlers
const commands = {
    '/start': (chatId) => {
        return `🎮 Welcome to SweetflipsStreamBot!

I'm your interactive gaming companion for Sweetflips streams!

🎯 **Available Commands:**
/gtbonus - Guess the total bonuses (when activated by admin)
/gtbalance - Guess the end balance (when activated by admin)
/trivia - Submit trivia answers during stream
/help - Show all commands

🔗 **Want to connect your Kick account?**
This will link your Telegram account to your Kick username so you can participate in games and earn rewards!

Use /help to see all available commands!`;
    },

    '/help': (chatId) => {
        return `🤖 SweetflipsStreamBot Commands:

🎮 **Available to Everyone:**
/start - Welcome message & account linking info
/help - Show this help

🎯 **Stream Games (Admin Activated):**
/gtbonus - Submit ONE guess for total bonuses Sweetflips will collect
/gtbalance - Submit ONE guess for Sweetflips' end balance
/trivia - Submit trivia answers during stream

📊 **How it works:**
• Admins activate games before stream starts
• You can only submit ONE guess per game
• Leaderboards show who's closest to the actual amounts
• Winners get rewards after the stream!

🔗 **Account Linking:**
Connect your Kick account to participate in games and earn rewards!`;
    },

    '/gtbonus': (chatId) => {
        return `🎯 **Guess the Bonuses Game**

This game is currently **INACTIVE** ❌

When an admin activates this game, you'll be able to:
• Submit ONE guess for total bonuses Sweetflips collects
• See live leaderboard during stream
• Win rewards if you're closest!

⏰ Check back when the stream starts!`;
    },

    '/gtbalance': (chatId) => {
        return `💰 **Guess the Balance Game**

This game is currently **INACTIVE** ❌

When an admin activates this game, you'll be able to:
• Submit ONE guess for Sweetflips' end balance
• See live leaderboard during stream
• Win rewards if you're closest!

⏰ Check back when the stream starts!`;
    },

    '/trivia': (chatId) => {
        return `🧠 **Trivia Game**

This game is currently **INACTIVE** ❌

When trivia is active during stream, you'll be able to:
• Submit answers to trivia questions
• Earn points for correct answers
• Compete on the live leaderboard

⏰ Check back during the stream!`;
    }
};

// Send message to Telegram
function sendMessage(chatId, text) {
    const data = JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
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
        console.log(`📤 Sent response to chat ${chatId}: ${text.substring(0, 50)}...`);
    });

    req.on('error', (error) => {
        console.error('❌ Error sending message:', error);
    });

    req.write(data);
    req.end();
}

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
                            const username = update.message.from.username || update.message.from.first_name;

                            console.log(`📨 Received: "${text}" from @${username} (${chatId})`);

                            // Handle commands
                            if (commands[text]) {
                                const response = commands[text](chatId);
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
console.log('🤖 Starting SweetflipsStreamBot (Polling Mode)');
console.log('==============================================');
console.log(`Bot: ${BOT_USERNAME}`);
console.log('Mode: Polling (no webhook needed)');
console.log('Status: Waiting for messages...');
console.log('');
console.log('📱 Test your bot by sending /start or /help');
console.log('');

getUpdates();
