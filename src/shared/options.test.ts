import { describe, expect, test } from "bun:test";
import { DEFAULT_SESSION_LIMIT, parseOsNotifications, parseSessionLimit } from "./options.ts";

test("parseSessionLimit", () => {
  expect(parseSessionLimit(undefined)).toBe(DEFAULT_SESSION_LIMIT);
  expect(parseSessionLimit({ sessionLimit: 50 })).toBe(50);
  expect(parseSessionLimit({ sessionLimit: 12.7 })).toBe(12);
  expect(parseSessionLimit({ sessionLimit: 0 })).toBe(DEFAULT_SESSION_LIMIT);
  expect(parseSessionLimit({ sessionLimit: "10" })).toBe(DEFAULT_SESSION_LIMIT);
  expect(parseSessionLimit({ sessionLimit: 10 ** 9 })).toBe(5000);
});

test("parseOsNotifications defaults to on", () => {
  expect(parseOsNotifications(undefined)).toBe(true);
  expect(parseOsNotifications({})).toBe(true);
  expect(parseOsNotifications({ osNotifications: true })).toBe(true);
  expect(parseOsNotifications({ osNotifications: false })).toBe(false);
});
