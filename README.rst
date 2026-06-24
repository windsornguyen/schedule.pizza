sched
=====

Open-source scheduling. Agent-native.

Google Calendar only. No teams yet. Individuals with org-scoped billing.


What it does
------------

Each user has a profile keyed by an ``orgId``. A user is an org. An org
can have children orgs (for future billing hierarchy). Users share their
URL. Visitors see available times and book directly. The booking lands
on both calendars via Google Calendar API.

Slot granularity is per-user configurable (15m, 30m, 1h, etc).


Multi-party scheduling
----------------------

Given a meeting of N people, the system finds a time that works for
everyone. When no perfect slot exists, it returns the closest options
ranked by conflict severity.

For each proposed alternative, the algorithm identifies:

- Which participants have conflicts
- Which conflicting events are marked "flexible" or "tentative"
- Rescheduling suggestions that minimize total disruption

This is the hard problem the product solves. Everything else is plumbing.


API
---

Agent-facing REST API with OpenAPI schema. Agents can discover
availability, book slots, and invoke multi-party scheduling without
a browser.

::

    GET  /api/v1/availability?user={username}
    POST /api/v1/book
    GET  /api/v1                                 # self-describing schema

Request and response bodies are JSON.


Data model
----------

::

    org
      id          uuid
      parent_id   uuid | null
      name        text

    user
      id          uuid
      org_id      uuid  -> org.id
      email       text
      calendar_id text  (google calendar id)
      slot_size   int   (minutes, default 30)

    booking
      id          uuid
      host_id     uuid  -> user.id
      guest_email text
      guest_name  text
      start_at    timestamptz
      end_at      timestamptz
      status      enum(confirmed, cancelled)
      gcal_event  text  (google calendar event id)


Stack
-----

- React Router 8, Vite, Cloudflare Workers (SSR)
- Tailwind v4, shadcn/ui design tokens
- Google Calendar API (OAuth2)
- D1 (Cloudflare SQL) for persistence (planned)
- TypeScript, oxlint, vitest


Development
-----------

::

    pnpm install
    pnpm dev          # http://localhost:5173
    pnpm build        # production build
    pnpm deploy       # deploy to cloudflare (requires wrangler login)
    pnpm lint         # oxlint
    pnpm typecheck    # tsc


License
-------

MIT
