# Instructions for Coding Agents

## Standard

This repo is production code. Prefer the smallest correct diff, fail closed, and keep behavior easy to prove.

Read the existing code before changing it. Match the local React Router, Cloudflare Workers, TypeScript, and Drizzle patterns already in the repo.

## Quality Gate

Run the narrowest relevant command while working, then run the full gate before handing off:

```bash
pnpm check
```

The gate is intentionally strict. TypeScript should reject uncertain values. Oxlint warnings fail CI.

## Lint Suppressions

Lint suppressions are surgical.

- Use line-level suppressions only.
- Name the exact rule.
- Include a plain-English justification after `--`.
- Never use file-level disables.
- Never suppress generated errors by broad category.

Acceptable:

```ts
// oxlint-disable-next-line no-console -- failed webhook delivery must reach the log drain
console.error(error);
```

Not acceptable:

```ts
/* oxlint-disable */
// oxlint-disable-next-line
```

If a rule is wrong for a whole pattern, change `.oxlintrc.json` in a separate PR and explain the repo-level invariant.

## TypeScript

Use `unknown` instead of `any`. Parse external input at the boundary, then pass typed values inward.

Do not use non-null assertions. Prove the invariant with control flow, schema parsing, or a typed helper that throws a specific error.

Avoid silent fallbacks. If the primary implementation is unavailable, throw a specific error naming the missing requirement.

## Database

The schema source of truth is TypeScript under `apps/pizza/app/db/schema/`. Generate migration SQL from Drizzle. Do not hand-write ordinary migration SQL.
