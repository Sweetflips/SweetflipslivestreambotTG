## Prohibited Practices

- Do not store Google API credentials, Telegram bot tokens, or Kick.com secrets in code or public repositories; always use environment variables.
- Avoid using unrestricted or overly broad OAuth scopes for Google APIs; request only the minimum required permissions.
- Never expose Telegram bot tokens or Google API keys in logs, error messages, or client-side code.
- Do not bypass Google API quota or rate limits; implement proper error handling and backoff strategies.
- Avoid polling Google Sheets or Kick.com endpoints excessively; use webhooks or efficient polling intervals.
- Never use unofficial or deprecated libraries for Google Sheets, Telegram Bot API, or Kick.com integrations.
- Do not process or store sensitive user data from external services without explicit consent and compliance with relevant policies.
- Avoid hardcoding external service endpoints; use configuration files or environment variables.
- Never ignore or suppress errors from external API calls; always handle failures and log issues for review.
- Do not commit test or mock data containing real user information from Google Sheets, Telegram, or Kick.com.
- Avoid using synchronous or blocking calls to external APIs in production code; always use asynchronous patterns.
- Never share or reuse API credentials across unrelated projects or environments.
