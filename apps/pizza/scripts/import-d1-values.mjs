// Legacy D1 booking-code inserts used milliseconds in two seconds-based columns.
// Repair is explicit, column-scoped, and limited to plausible app timestamps.
export function convertD1Value(table, value, column, repairMilliseconds = false) {
  if (value === null) {
    if (column.notNull) throw new Error(`unexpected null: ${column.name}`);
    return { value: null, repaired: false };
  }
  if (column.type.startsWith("timestamp")) {
    if (!Number.isSafeInteger(value)) throw new Error(`invalid epoch: ${column.name}`);
    const min = Date.parse("2000-01-01T00:00:00Z");
    const max = Date.parse("2100-01-01T00:00:00Z");
    if (value >= min / 1000 && value < max / 1000) {
      return { value: new Date(value * 1000).toISOString(), repaired: false };
    }
    if (repairMilliseconds && table === "booking_code" && ["createdAt", "expiresAt"].includes(column.name) && value >= min && value < max) {
      return { value: new Date(value).toISOString(), repaired: true };
    }
    throw new Error(`timestamp outside supported seconds range: ${table}.${column.name}`);
  }
  if (column.type === "boolean") {
    if (value !== 0 && value !== 1) throw new Error(`invalid boolean: ${column.name}`);
    return { value: value === 1, repaired: false };
  }
  if (column.type === "integer" || column.type === "bigint") {
    if (!Number.isSafeInteger(value)) throw new Error(`invalid integer: ${column.name}`);
    return { value, repaired: false };
  }
  if (column.type !== "text" || typeof value !== "string") throw new Error(`unsupported value: ${column.name}`);
  return { value, repaired: false };
}
