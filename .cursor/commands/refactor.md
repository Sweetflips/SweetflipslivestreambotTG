## Refactoring (Python STT / relay)

- Prefer small, focused changes; do not mix unrelated cleanups with bugfixes.
- Match existing style: typing, logging, and module layout in this repo.
- Keep shared transcript vocabulary in `transcript_normalization.py` (single source).
- After refactors that touch behavior, run `python -m compileall` and any tests.
- Commit and push when the workspace rule requires it.
