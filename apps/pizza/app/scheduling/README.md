# Scheduling

Backend contract for finding meeting times across one or more profiles.

## Scope

Scheduling owns derived availability: interval arithmetic, exact availability
queries, and ranked alternatives.

It does not own host auth, guest booking-code auth, calendar OAuth, or durable
booking writes. Those subsystems authorize callers, fetch provider state, or
commit a booking after scheduling returns a candidate.

## Interface Boundary

The authoritative backend contract is `engine.ts`.

| Interface | Caller | Authority |
| --- | --- | --- |
| `SchedulingEngine` | API routes and agent/CLI entrypoints | Computes exact slots and ranked alternatives from a validated request. |
| `BusyIntervalSource` | Scheduling engine implementations | Reads busy intervals for requested profiles inside one window. |
| `IntervalOps` | Scheduling engine implementations | Performs pure UTC half-open interval operations. |
| `validateScheduleRequest` | API routes and engines | Rejects malformed requests before provider I/O. |

## Ownership

| Area | Writer | Meaning |
| --- | --- | --- |
| `ScheduleRequest` | API boundary | Requested participants, window, limits, duration, granularity, and display timezone. |
| `BusyInterval` | Calendar provider adapter | Provider conflicts normalized to UTC. |
| `ScheduleResult` | Scheduling engine | Exact slots, ranked alternatives, or a typed `none` state. |

`ScheduleResult` has three states:

- `exact`: at least one slot has no hard or soft conflicts.
- `alternatives`: no exact slot exists, but candidate slots can be ranked by
  conflict cost.
- `none`: the engine has no candidate slots inside the requested window.

## Semantics

`requiredProfileIds` must be non-empty and deduplicated. `window` uses
half-open UTC intervals: `[startAtMs, endAtMs)`.

The contract uses UTC epoch milliseconds. API routes and CLIs may accept ISO
strings, but they must parse them before calling the engine. `Date` objects do
not cross this contract.

The engine validates before provider I/O. Invalid requests return typed
validation codes rather than pretending there is no availability.

Exact slots require every requested profile to be free for the whole interval.
Alternative slots are not bookable by default. They explain which fixed and
movable events block a candidate so the product can propose rescheduling.

Provider adapters must not fall back silently. If the primary busy source is
unavailable, the engine raises a typed `ScheduleEngineError` with
`busy_interval_source_failed`.

## Compatibility and Debug

There is no compatibility surface yet. Debug endpoints must not become a second
scheduling API.

## References

- `docs/algorithm/README.md`
- `slots.server.ts`
