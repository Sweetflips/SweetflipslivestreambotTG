## Testing

- Prefer `pytest` with isolated tests; avoid depending on GPU or live OBS unless marked optional.
- Do not commit `pytest` skips/markers that disable the suite without a documented reason.
- Do not commit failing tests; fix or revert before merge.
- Avoid hardcoded secrets in tests; use env vars or fixtures.
