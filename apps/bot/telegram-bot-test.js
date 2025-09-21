// Simple Telegram Bot Test
const https = require('https');

const BOT_TOKEN = '8422817933:AAHm0YU707fnBeuehr-QrFJD-4A9M6aTCPc';
const BOT_USERNAME = '@sweetflipsstreambot';

// Test bot connection
function testBot() {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getMe`;

    https.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            try {
                const botInfo = JSON.parse(data);
                console.log('🤖 Bot Information:');
                console.log(`   Username: ${botInfo.result.username}`);
                console.log(`   First Name: ${botInfo.result.first_name}`);
                console.log(`   ID: ${botInfo.result.id}`);
                console.log(`   Can Join Groups: ${botInfo.result.can_join_groups}`);
                console.log(`   Can Read All Group Messages: ${botInfo.result.can_read_all_group_messages}`);
                console.log(`   Supports Inline Queries: ${botInfo.result.supports_inline_queries}`);
                console.log('');
                console.log('✅ Bot is working! You can now:');
                console.log('1. Start a chat with your bot: https://t.me/sweetflipsstreambot');
                console.log('2. Add it to your groups');
                console.log('3. Test the /start command');
            } catch (error) {
                console.error('❌ Error parsing bot info:', error);
            }
        });
    }).on('error', (error) => {
        console.error('❌ Error connecting to bot:', error);
    });
}

// Set webhook
function setWebhook() {
    const webhookUrl = 'https://your-domain.com/webhook/telegram'; // You'll need to replace this
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;

    console.log('📡 To set up webhook for production, use:');
    console.log(`   ${url}`);
    console.log('');
    console.log('🔧 For local testing, you can use ngrok:');
    console.log('   1. Install ngrok: https://ngrok.com/');
    console.log('   2. Run: ngrok http 3000');
    console.log('   3. Use the https URL for webhook');
}

console.log('🚀 Testing SweetflipsStreamBot Telegram Integration');
console.log('==================================================');
console.log('');

testBot();
setWebhook();

