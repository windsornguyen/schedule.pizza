# Contributing

Thanks for your interest in contributing to schedule.pizza.

## Quick Links

| Resource | Description |
| --- | --- |
| [SECURITY.md](SECURITY.md) | Reporting vulnerabilities |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Community standards |
| [SUPPORT.md](SUPPORT.md) | Getting help |

## Development Setup

```bash
pnpm install
pnpm --filter @schedule.pizza/web dev
```

Run checks before opening a pull request:

```bash
pnpm --filter @schedule.pizza/web lint
pnpm --filter @schedule.pizza/web typecheck
pnpm --filter @schedule.pizza/web test
pnpm --filter @schedule.pizza/web db -- check
pnpm --filter @schedule.pizza/web build
```

## Database Changes

The database schema is defined in TypeScript under
`apps/pizza/app/db/schema/`. Generate migrations from the schema:

```bash
pnpm --filter @schedule.pizza/web db -- generate
```

Do not hand-write migration SQL for ordinary schema changes. The TypeScript
schema is the review surface; generated SQL is the deploy artifact.

## Pull Requests

1. Create a branch from `main`.
2. Keep the PR small and focused.
3. Add tests for new behavior.
4. Update docs when behavior changes.
5. Fill out the PR template completely.

PR titles should use Conventional Commits:

```text
feat(db): add booking code schema
fix(api): reject invalid booking slots
docs: clarify setup
```

## AI Assistance Disclosure

If you use AI assistance to contribute, mention it in your PR. Contributors are
expected to understand and explain the code they submit.

## License

By contributing, you agree that your contributions will be licensed under the
MIT License.
