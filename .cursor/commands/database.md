## Prohibited Practices
- Always use PostgreSQL for all Railway deployments.
- Never use SQLite in any Railway environment.

- Do not use raw SQL queries; always use Prisma for database access.
- Avoid using SQLite in production; use PostgreSQL for all production environments.
- Do not hardcode database credentials or connection strings; use environment variables.
- Never bypass Prisma schema validation or migrations.
- Avoid using Redis as a primary data store; use it only for caching and session storage.
- Do not use Prisma's `$queryRaw` or `$executeRaw` without proper input sanitization.
- Never commit `.env` files or database dumps to version control.
- Avoid schema changes directly in the database; always use Prisma migrations.
- Do not use Redis for persistent or critical data.
- Never use blocking or synchronous database operations in application code.
- Avoid using deprecated or experimental Prisma features in production.
- Do not mix direct PostgreSQL/SQLite drivers with Prisma in the same project.
