// Simple Telegram Bot Test
const https = require('https');

const BOT_TOKEN = '8422817933:AAHm0YU707fnBeuehr-QrFJD-4A9M6aTCPc';
let lastUpdateId = 0;

console.log('🤖 Starting Simple Bot...');
console.log('Bot Token:', BOT_TOKEN.substring(0, 10) + '...');
console.log('Waiting for messages...');

function sendMessage(chatId, text) {
    const data = JSON.stringify({
        chat_id: chatId,
        text: text
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
        console.log(`📤 Sent: ${text.substring(0, 30)}...`);
    });

    req.on('error', (error) => {
        console.error('❌ Send error:', error);
    });

    req.write(data);
    req.end();
}

function getUpdates() {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;

    console.log('🔄 Polling for updates...');

    https.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            try {
                const response = JSON.parse(data);
                console.log('📨 Response received:', response.ok ? 'OK' : 'ERROR');

                if (response.ok && response.result.length > 0) {
                    response.result.forEach(update => {
                        lastUpdateId = update.update_id;

                        if (update.message) {
                            const chatId = update.message.chat.id;
                            const text = update.message.text;
                            const username = update.message.from.username || update.message.from.first_name;

                            console.log(`📨 Message: "${text}" from @${username}`);

                            // Simple responses
                            if (text === '/start') {
                                sendMessage(chatId, '🎮 Welcome to SweetflipsStreamBot!\n\nUse /help to see commands!');
                            } else if (text === '/help') {
                                sendMessage(chatId, '🤖 Available commands:\n/start - Welcome\n/help - This help\n/gtbonus - Guess bonuses (inactive)\n/gtbalance - Guess balance (inactive)\n/trivia - Trivia (inactive)');
                            } else if (text === '/gtbonus') {
                                sendMessage(chatId, '🎯 Guess the Bonuses Game\n\nThis game is currently INACTIVE ❌\n\nCheck back when the stream starts!');
                            } else if (text === '/gtbalance') {
                                sendMessage(chatId, '💰 Guess the Balance Game\n\nThis game is currently INACTIVE ❌\n\nCheck back when the stream starts!');
                            } else if (text === '/trivia') {
                                sendMessage(chatId, '🧠 Trivia Game\n\nThis game is currently INACTIVE ❌\n\nCheck back during the stream!');
                            } else {
                                sendMessage(chatId, `🤖 I received: "${text}"\n\nUse /help to see available commands!`);
                            }
                        }
                    });
                }

                // Continue polling
                setTimeout(getUpdates, 1000);

            } catch (error) {
                console.error('❌ Parse error:', error);
                setTimeout(getUpdates, 5000);
            }
        });
    }).on('error', (error) => {
        console.error('❌ Request error:', error);
        setTimeout(getUpdates, 5000);
    });
}

// Start polling
getUpdates();

