export function loader() {
  return Response.json({
    name: "schedule.pizza",
    version: "0.0.1",
    endpoints: {
      availability: {
        method: "GET",
        path: "/api/v1/availability",
        params: {
          user: "string (required)",
          code: "string (required, booking code)",
        },
        headers: {
          "CF-Connecting-IP": "string (required, set by Cloudflare)",
        },
        description: "Get available time slots for a user.",
      },
      book: {
        method: "POST",
        path: "/api/v1/book",
        body: {
          user: "string (required)",
          code: "string (required, booking code)",
          slot: "string (required, ISO 8601 start time)",
          name: "string (required, booker name)",
          email: "string (optional, booker email)",
          timezone: "string (optional, booker timezone)",
        },
        headers: {
          "CF-Connecting-IP": "string (required, set by Cloudflare)",
        },
        description: "Book a time slot with a user.",
      },
    },
    errors: {
      400: ["missing_parameter", "invalid_json", "missing_field", "invalid_slot"],
      404: ["booking_code_invalid"],
      409: ["slot_unavailable"],
      429: ["booking_code_rate_limited"],
      500: ["client_ip_unavailable", "host_configuration_invalid"],
    },
  });
}
