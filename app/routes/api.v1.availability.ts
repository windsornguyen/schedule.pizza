const MOCK_SLOTS = [
  { start: "2025-06-24T09:00:00Z", end: "2025-06-24T09:30:00Z" },
  { start: "2025-06-24T10:00:00Z", end: "2025-06-24T10:30:00Z" },
  { start: "2025-06-24T14:00:00Z", end: "2025-06-24T14:30:00Z" },
  { start: "2025-06-24T15:00:00Z", end: "2025-06-24T15:30:00Z" },
  { start: "2025-06-25T09:00:00Z", end: "2025-06-25T09:30:00Z" },
  { start: "2025-06-25T11:00:00Z", end: "2025-06-25T11:30:00Z" },
  { start: "2025-06-25T13:00:00Z", end: "2025-06-25T13:30:00Z" },
];

export function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const user = url.searchParams.get("user");

  if (!user) {
    return Response.json(
      { error: "Missing required parameter: user" },
      { status: 400 }
    );
  }

  return Response.json({
    user,
    timezone: "UTC",
    slots: MOCK_SLOTS,
  });
}
