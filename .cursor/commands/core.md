## Prohibited Practices

- Do not use `require` in TypeScript files; always use ES module `import`/`export`.
- Avoid using `var`; use `let` or `const` for variable declarations.
- Do not bypass TypeScript type checks with `any` or `@ts-ignore` unless absolutely necessary and justified.
- Never commit `node_modules` or build artifacts to version control.
- Do not use deprecated Node.js or JavaScript APIs.
- Avoid global variables; encapsulate logic within modules or classes.
- Do not use `npm` or `yarn` for dependency management; always use `pnpm`.
- Do not mix JavaScript and TypeScript in the same module or workspace.
- Avoid circular dependencies between modules.
- Do not disable strict mode in TypeScript configuration.
- Never use insecure or unmaintained packages.
- Do not use synchronous filesystem or network operations in production code.
- Avoid hardcoding secrets or credentials in the codebase.
- Do not use magic numbers or strings; define constants or enums.
- Never ignore linter or formatter errors; always address them before committing.
