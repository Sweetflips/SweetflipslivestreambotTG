## Prohibited Practices

- Do not use Express.js or Koa; always use Fastify for HTTP APIs.
- Avoid using callbacks for asynchronous code; use async/await or Promises.
- Do not use deprecated Fastify plugins or middleware.
- Never expose internal Fastify, Telegraf, or Socket.io objects directly to clients.
- Do not use polling for real-time features; always use WebSocket or Socket.io.
- Avoid mixing Telegraf and Fastify route handlers in the same file.
- Do not use global event emitters for WebSocket or Socket.io; encapsulate event logic.
- Never block the event loop with synchronous code in request or message handlers.
- Do not use hardcoded bot tokens or secrets; always use environment variables.
- Avoid using the native `ws` module and Socket.io in the same connection context.
- Do not bypass Fastify or Telegraf error handling; always use their provided mechanisms.
- Never use `any` type for WebSocket or Socket.io payloads; define strict interfaces.
- Do not use legacy Telegram Bot API methods; always use Telegraf's abstractions.
- Avoid using `require` in backend code; always use ES module `import`/`export`.
- Never commit sensitive configuration or credentials to version control.
