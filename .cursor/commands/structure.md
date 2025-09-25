## Prohibited Practices

- Do not mix unrelated features or services in the same module or folder; always separate by domain.
- Avoid circular dependencies between modules, features, or services.
- Never place shared utilities or types inside application-specific folders; use a dedicated shared or packages directory.
- Do not commit build artifacts, node_modules, or .env files to version control.
- Avoid using absolute paths outside the workspace root; always use relative or workspace-based imports.
- Never bypass pnpm workspace configuration; always add dependencies at the correct scope (root, app, or package).
- Do not hardcode configuration values; use environment variables or configuration files per environment.
- Avoid duplicating code between apps/api and apps/bot; extract shared logic to packages.
- Never modify another app’s code from a different app’s folder; maintain strict boundaries.
- Do not place feature code directly in the root of apps/api or apps/bot; always organize by feature.
- Avoid using a flat folder structure for features; group related files (routes, services, models) within feature folders.
- Never commit test files or mock data to production branches; remove them when done.
- Do not use ambiguous or generic folder names; always use clear, descriptive names for features and packages.
