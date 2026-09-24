/** One transaction-held row lock per IP serializes booking-code quota decisions. */
import { pgTable, text } from "drizzle-orm/pg-core";

export const bookingCodeGate = pgTable("booking_code_gate", {
  ipHash: text("ipHash").primaryKey(),
});
