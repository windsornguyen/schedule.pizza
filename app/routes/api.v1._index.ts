export function loader() {
  return Response.json({
    name: "sched",
    version: "0.0.1",
    endpoints: {
      availability: {
        method: "GET",
        path: "/api/v1/availability",
        params: { user: "string (required)" },
        description: "Get available time slots for a user.",
      },
      book: {
        method: "POST",
        path: "/api/v1/book",
        body: {
          user: "string (required)",
          slot: "string (required, ISO 8601 start time)",
          name: "string (required, booker name)",
          email: "string (optional, booker email)",
        },
        description: "Book a time slot with a user.",
      },
    },
  });
}
