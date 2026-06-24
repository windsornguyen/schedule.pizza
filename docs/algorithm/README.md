# Multi-Party Scheduling

Given a meeting of N people, find the best time that works for everyone.

## When a perfect slot exists

Intersect all participants' free windows at the requested granularity.
Return the first available slot (or all, sorted by preference — morning
bias, proximity to now, etc).

## When no perfect slot exists

Rank alternatives by conflict severity:

1. Collect each participant's calendar for the search window.
2. For each candidate slot, compute a conflict score:
   - 0 if participant is free
   - low if the conflicting event is marked "tentative" or "flexible"
   - high if the conflicting event is "busy" / non-movable
3. Sort candidates by total conflict score ascending.
4. For the top K candidates, identify:
   - Which participants have conflicts
   - Which of those conflicts are movable
   - Concrete rescheduling suggestions that minimize total disruption

## Slot flexibility

Users can mark events with flexibility metadata via the API or UI.
The algorithm treats "flexible" events as soft constraints — it will
suggest moving them when doing so unlocks a slot for the full group.

## API

```
POST /api/v1/schedule
{
  "participants": ["user-a", "user-b", "user-c"],
  "duration": 30,
  "window": {
    "start": "2025-06-24T00:00:00Z",
    "end": "2025-06-28T00:00:00Z"
  }
}
```
