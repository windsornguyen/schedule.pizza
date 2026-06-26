# Scheduling

The scheduling package owns derived availability. It does not own identity,
booking authorization, calendar writes, or billing.

## Interfaces

`SchedulingEngine` is the orchestration contract. It receives an authorized
set of required profile ids, a UTC search window, a duration, and slot
granularity. It returns exact slots when every required profile is free. If no
exact slot exists, it returns ranked alternatives with the conflicts that would
need to move.

`BusyIntervalSource` is the only read dependency. It returns busy intervals for
the requested profile ids and window. Source failures must fail closed; the
engine must not treat an unavailable source as an empty calendar.

`IntervalOps` is pure interval arithmetic. It has no I/O and no authority over
profile, booking, or calendar state.

## Authority

The interval store or calendar integration owns busy facts. The scheduling
engine may observe those facts and derive candidate slots from them.

The booking subsystem owns booking creation. A slot returned by the scheduling
engine is a candidate, not a reservation.

API and CLI adapters own authentication, booking-code authorization, and
profile-id admission. The scheduling engine assumes its caller has already
authorized the profile ids in the request.

## Time

The engine contract uses UTC epoch milliseconds and half-open intervals:
`[startAtMs, endAtMs)`. API adapters may accept ISO strings, but they must parse
them before calling the engine. `Date` objects do not cross this contract.

`timeZone` is display context for slot generation and ranking. It is not the
source of truth for storage.

## Alternatives

Alternatives are ranked by `conflictCost`, where lower is better. Hard
conflicts are events that cannot move. Soft conflicts are movable events and
carry a `moveCost` so future ranking strategies can preserve user preference
without changing the public result shape.
