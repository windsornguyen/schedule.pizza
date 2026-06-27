# Product Hunt Launch Kit

Operator notes for the schedule.pizza Product Hunt listing. This is not product
documentation; the public docs remain focused on using the app and API.

## Listing

- URL: `https://schedule.pizza`
- Name: `schedule.pizza`
- Tagline: `easiest way to find a time`
- Description:

```text
schedule.pizza is a small scheduling app for people and agents. Share a booking
link, show only authorized availability, book Google Calendar slots, and find a
time across several people with exact slots or ranked alternatives.
```

## Topics

- Productivity
- AI Agents
- Calendar

## Gallery

Product Hunt recommends a 240x240 thumbnail and 1270x760 gallery images. The
committed PNGs are generated from the SVG sources in this folder.

- `assets/product-hunt-thumbnail.png`
- `assets/gallery-01-find-a-time.png`
- `assets/gallery-02-booking-link.png`
- `assets/gallery-03-group-scheduling.png`

## First Comment

```text
Hey Product Hunt,

I built schedule.pizza because scheduling should be small enough to trust.

The product is intentionally simple: hosts connect Google Calendar, create a
share link, and give that link to people or agents. The code in the link is the
capability. Without it, usernames do not expose availability.

What works today:

- individual booking links
- Google Calendar availability and booking writes
- group scheduling across multiple links
- ranked alternatives when no exact group slot exists
- a JSON API designed for agents

I would especially love feedback on the agent API and the group scheduling flow.
```

## FAQ

### Who is this for?

People who want a tiny scheduling link and agents that need a direct API for
finding and booking time.

### Why booking codes?

The booking code makes the link a capability. Guessing a username is not enough
to see availability or book time.

### Does it write to Google Calendar?

Yes. A booking succeeds only after the Google Calendar event is created.

### Can agents use it?

Yes. Agents can call `/api/v1/availability`, `/api/v1/book`,
`/api/v1/schedule`, `/api/v1/recommend`, and `/api/v1/book-group`.

### Does it support teams?

Not yet. Group scheduling works across multiple individual links. Team accounts
can come later without changing the core booking-code model.
