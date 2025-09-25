## Prohibited Practices

- Do not use `test.only` or `test.skip` in committed code; always run the full test suite.
- Avoid using global state or side effects in tests; ensure tests are isolated and independent.
- Do not disable or ignore ESLint rules without clear justification.
- Never suppress TypeScript errors with `@ts-ignore` unless absolutely necessary and documented.
- Avoid using `any` type in tests; prefer strict typing for all test data and mocks.
- Do not commit code with failing tests or lint errors.
- Never bypass or disable coverage thresholds; maintain and enforce minimum coverage.
- Avoid using deprecated or experimental Vitest APIs in production test suites.
- Do not use hardcoded values for environment variables or secrets in tests.
- Never commit coverage or test output files to version control.
- Avoid using synchronous code in asynchronous test scenarios.
- Do not mock modules or functions unnecessarily; prefer real implementations unless isolation is required.
