# Data Model

```
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
```

A user is an org. An org can have children orgs (for billing hierarchy).
