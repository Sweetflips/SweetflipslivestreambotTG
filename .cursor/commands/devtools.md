## Prohibited Practices

- Do not use `tsx` in production environments; restrict its usage to development only.
- Avoid running multiple instances of `nodemon` for the same project concurrently.
- Do not use `nodemon` for production process management; use a dedicated process manager.
- Never bypass TypeScript compilation errors by running code directly with `tsx`.
- Avoid using outdated or unsupported versions of `tsx`, `nodemon`, or `tsc-alias`.
- Do not modify TypeScript path aliases without updating `tsc-alias` configuration accordingly.
- Never commit auto-generated or temporary files created by `nodemon`, `tsx`, or `tsc-alias` to version control.
- Avoid using custom scripts that override the default behavior of `tsx`, `nodemon`, or `tsc-alias` without clear documentation.
- Do not ignore warnings or errors emitted by `tsc-alias` during the build process.
- Never use hardcoded paths in place of TypeScript path aliases.
