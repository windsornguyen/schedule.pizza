interface BookingRequest {
  user: string;
  slot: string;
  name: string;
  email?: string;
}

function isValidBooking(body: unknown): body is BookingRequest {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as BookingRequest).user === "string" &&
    typeof (body as BookingRequest).slot === "string" &&
    typeof (body as BookingRequest).name === "string"
  );
}

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405 }
    );
  }

  const body: unknown = await request.json();

  if (!isValidBooking(body)) {
    return Response.json(
      { error: "Missing required fields: user, slot, name" },
      { status: 400 }
    );
  }

  return Response.json({
    ok: true,
    booking: {
      id: crypto.randomUUID(),
      user: body.user,
      slot: body.slot,
      booker: { name: body.name, email: body.email ?? null },
      status: "confirmed",
    },
  });
}
