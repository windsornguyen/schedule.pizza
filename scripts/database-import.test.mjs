import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { convertD1Value } from "../apps/pizza/scripts/import-d1-values.mjs";

const createdAt = { name: "createdAt", type: "timestamp (3) with time zone", notNull: true };

describe("D1 transfer values", () => {
  it("preserves seconds-based timestamps and rejects ambiguous units by default", () => {
    const seconds = 1782513837;
    assert.deepEqual(convertD1Value("booking_code", seconds, createdAt), {
      value: new Date(seconds * 1000).toISOString(), repaired: false,
    });
    assert.throws(() => convertD1Value("booking_code", seconds * 1000, createdAt), /seconds range/);
  });

  it("repairs only explicitly permitted legacy booking-code columns", () => {
    const milliseconds = 1782513837187;
    assert.deepEqual(convertD1Value("booking_code", milliseconds, createdAt, true), {
      value: new Date(milliseconds).toISOString(), repaired: true,
    });
    assert.throws(() => convertD1Value("session", milliseconds, createdAt, true), /seconds range/);
    assert.throws(() => convertD1Value("booking_code", milliseconds, { ...createdAt, name: "revokedAt" }, true), /seconds range/);
  });

  it("rejects corrupt booleans and nulls rather than coercing them", () => {
    const column = { name: "success", type: "boolean", notNull: true };
    assert.deepEqual(convertD1Value("booking_code_attempt", 0, column), { value: false, repaired: false });
    assert.deepEqual(convertD1Value("booking_code_attempt", 1, column), { value: true, repaired: false });
    assert.throws(() => convertD1Value("booking_code_attempt", 2, column), /invalid boolean/);
    assert.throws(() => convertD1Value("booking_code_attempt", null, column), /unexpected null/);
  });
});
