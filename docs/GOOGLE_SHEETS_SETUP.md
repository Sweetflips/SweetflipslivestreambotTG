# Google Sheets Integration Setup

This guide will help you set up Google Sheets integration to automatically store linked Telegram-Kick accounts.

## 📋 Prerequisites

1. A Google account
2. Access to Google Cloud Console
3. A Google Sheets spreadsheet

## 🚀 Step-by-Step Setup

### 1. Create a Google Sheets Spreadsheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it "SweetflipsStreamBot - Linked Accounts"
4. Copy the spreadsheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
   ```

### 2. Set up Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Enable the Google Sheets API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

### 3. Create Service Account

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Fill in the details:
   - **Name**: `sweetflips-bot-service`
   - **Description**: `Service account for SweetflipsStreamBot`
4. Click "Create and Continue"
5. Skip the optional steps and click "Done"

### 4. Generate Service Account Key

1. In the Credentials page, find your service account
2. Click on the service account email
3. Go to "Keys" tab
4. Click "Add Key" > "Create new key"
5. Choose "JSON" format
6. Download the key file
7. **Important**: Keep this file secure and never commit it to version control

### 5. Share Spreadsheet with Service Account

1. Open your Google Sheets spreadsheet
2. Click "Share" button
3. Add the service account email (found in the JSON key file)
4. Give it "Editor" permissions
5. Click "Send"

### 6. Configure Environment Variables

Create a `.env` file in your project root with:

```env
# Google Sheets Configuration
GOOGLE_SHEETS_ID=your_spreadsheet_id_here
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=path/to/your/service-account-key.json
```

**Example:**

```env
GOOGLE_SHEETS_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./credentials/service-account-key.json
```

### 7. File Structure

Your project should look like this:

```
Stream Bot/
├── .env
├── credentials/
│   └── service-account-key.json
├── test-polling-bot.js
└── ...
```

## 🔧 Testing the Integration

1. Start your bot:

   ```bash
   node test-polling-bot.js
   ```

2. You should see:

   ```
   ✅ Google Sheets service initialized successfully
   ✅ Google Sheets headers initialized
   ```

3. Test linking an account:
   - Use `/kick` command
   - Send a username
   - Check your Google Sheets - a new row should appear!

## 📊 Google Sheets Format

The bot will automatically create these columns:

| Column | Description       |
| ------ | ----------------- |
| A      | Telegram ID       |
| B      | Telegram Username |
| C      | Kick Username     |
| D      | Linked Date       |
| E      | Role              |
| F      | Timestamp         |

## 🛠️ Troubleshooting

### Common Issues:

1. **"Sheets integration disabled"**

   - Check your `.env` file has the correct variables
   - Verify the service account key file path

2. **"Permission denied"**

   - Make sure you shared the spreadsheet with the service account email
   - Check the service account has "Editor" permissions

3. **"API not enabled"**

   - Go to Google Cloud Console
   - Enable the Google Sheets API

4. **"Invalid credentials"**
   - Verify the service account key file is valid JSON
   - Check the file path is correct

## 🔒 Security Notes

- **Never commit** the service account key file to version control
- Add `credentials/` to your `.gitignore`
- Keep the key file secure and private
- Consider using environment variables for production

## 📈 Benefits

- **Real-time sync**: All linked accounts appear in Google Sheets instantly
- **Easy sharing**: Share the spreadsheet with team members
- **Data backup**: Your data is safely stored in Google's cloud
- **Analytics**: Use Google Sheets features for data analysis
- **Export**: Easy to export data to other formats

## 🎯 Next Steps

Once set up, every time someone links their account with `/kick`, it will automatically appear in your Google Sheets with:

- Their Telegram ID and username
- Their Kick username
- When they linked
- Their current role
- Timestamp of the sync

Perfect for tracking your community growth! 🚀
