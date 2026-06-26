# Multi-Party Scheduling

schedule.pizza treats the exact group-availability query as interval
intersection.

The backend contract for this behavior lives in
`apps/pizza/app/scheduling/engine.ts`.

## Inputs

- required profile ids
- search window
- meeting duration
- slot granularity
- display timezone

Profiles are keyed by `orgId`. An individual user is an org. A future team is
an org with child orgIds.

## Exact Availability

For each required profile:

1. Fetch busy intervals overlapping the search window.
2. Normalize intervals to UTC.
3. Treat intervals as half-open: `[start, end)`.
4. Merge overlaps.
5. Invert busy intervals into free intervals.

Intersect the sorted free interval lists. Any intersection at least as long as
the requested duration is bookable.

The overlap query for source intervals is:

```sql
org_id = :orgId
starts_at < :windowEnd
ends_at > :windowStart
```

With unsorted input, the query is `O(m log m)`. With sorted intervals, it is
`O(m)`. `m` is the number of busy intervals fetched for the query window.

## Alternative Availability

If no exact slot exists, rank candidate slots by conflict cost.

Each candidate reports:

- hard conflicts
- soft conflicts
- affected profiles
- movable events, when known
- nearest exact slot, when one exists outside the requested window

Soft conflicts are events a profile has marked as loose or movable. They do not
make a slot bookable by default. They explain which calendar moves would make
the slot work.

## Cache

The interval store is the source of truth.

For hot paths, availability can be materialized as bitsets over the profile's
slot granularity. At five-minute granularity, ninety days is 25,920 slots.
Exact availability for `n` required profiles is a bitwise AND followed by a scan
for runs long enough to fit the meeting duration.

## Hard Boundary

The single-meeting exact query is not NP-hard. It becomes an optimization
problem when the product asks to batch-schedule many meetings while optimizing
optional attendees, rooms, priorities, preferences, and rescheduling cost.
