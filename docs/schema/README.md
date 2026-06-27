# Data Model

The database schema is defined in TypeScript with Drizzle.

```
apps/pizza/app/db
  client.server.ts
  functions/
    booking_codes.server.ts
    host_profiles.server.ts
  schema/
    account.ts
    booking.ts
    booking_code.ts
    booking_code_attempt.ts
    host_profile.ts
    index.ts
    rate_limit.ts
    session.ts
    user.ts
    verification.ts
```

Each file in `schema/` owns one table. `schema/index.ts` is the single barrel
export consumed by Drizzle Kit and the runtime database client.

`functions/` is for database behavior: lookups, writes, and transactional units.
Schema files stay declarative.

Generate SQL migrations from the TypeScript schema:

```
pnpm --filter @schedule.pizza/web db -- generate
```

Do not hand-write migration SQL for ordinary schema changes. The generated SQL
is a deploy artifact; the TypeScript schema is the review surface.
