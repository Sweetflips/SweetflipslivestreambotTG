## Refactoring Guidelines

- Always use TypeScript for all frontend code; avoid plain JavaScript.
- Use TailAdmin components and design patterns for UI; do not mix with other UI libraries.
- Refactor legacy or custom styles to TailAdmin classes and utilities.
- Extract reusable UI logic and components into shared folders; avoid duplication.
- Remove unused code, variables, and imports during refactoring.
- Replace imperative DOM manipulation with declarative React patterns.
- Ensure all components are typed explicitly; avoid use of `any` or implicit types.
- Refactor large components into smaller, focused units with clear responsibilities.
- Use functional components and React hooks; avoid class components.
- Move business logic out of UI components into services or hooks.
- Refactor API calls to use centralized, typed services.
- Remove test files after use.
- After each refactor, commit changes and push to git.
- Always build and maintain a logical project structure with feature-based folders.
- Loop back and address any issues introduced during refactoring.
- Avoid ambiguous naming; use descriptive names for files, folders, and variables.
- Do not manually continue refactoring steps; automate and iterate as needed.
- Refactor for clarity, conciseness, and maintainability; avoid unnecessary repetition.
