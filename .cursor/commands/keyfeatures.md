## Prohibited Practices

- Do not implement RBAC with hardcoded roles or permissions; always use a centralized, configurable system.
- Avoid granting excessive privileges to default or guest users; follow the principle of least privilege.
- Never bypass or disable rate limiting for any user or endpoint; always enforce throttling consistently.
- Do not log sensitive information (e.g., passwords, tokens, balances) in audit logs; redact or hash where necessary.
- Avoid storing audit logs in unsecured or publicly accessible locations; always use encrypted storage.
- Never expose real-time game logic or internal algorithms to clients; keep all critical logic server-side.
- Do not allow client-side manipulation of game state or balance; always validate and process on the server.
- Avoid using polling for live balance updates; use efficient real-time mechanisms (e.g., webhooks, sockets).
- Never integrate with external balance providers without proper authentication and error handling.
- Do not mix platform-specific logic (Telegram, Kick.com) in shared modules; always separate integrations by platform.
- Avoid using unofficial or deprecated APIs for Telegram or Kick.com; always use supported, documented endpoints.
- Never process or store user data from Telegram or Kick.com without explicit consent and compliance with platform policies.
