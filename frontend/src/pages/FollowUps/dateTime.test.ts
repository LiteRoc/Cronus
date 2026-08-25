import { describe, expect, test, vi } from "vitest";
import { displayDueAt, effectiveTimeZone, localDateTimeToIso } from "./dateTime";

describe("FollowUp timezone semantics", () => {
  test("converts Facility-local wall time to the correct instant", () => {
    expect(localDateTimeToIso("2026-08-25T09:30", "America/New_York")).toBe("2026-08-25T13:30:00.000Z");
  });
  test("uses the browser IANA timezone when Facility metadata is missing", () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({ timeZone: "America/Chicago" } as Intl.ResolvedDateTimeFormatOptions);
    expect(effectiveTimeZone()).toBe("America/Chicago");
    expect(localDateTimeToIso("2026-08-25T09:30")).toBe("2026-08-25T14:30:00.000Z");
  });
  test("formats using the requested Facility timezone", () => {
    expect(displayDueAt("2026-08-25T13:30:00.000Z", "America/New_York")).toMatch(/9:30/);
  });
  test("rejects ambiguous repeated daylight-saving local time", () => {
    expect(() => localDateTimeToIso("2026-11-01T01:30", "America/New_York")).toThrow(/occurs twice/);
  });
  test("rejects nonexistent daylight-saving local time", () => {
    expect(() => localDateTimeToIso("2026-03-08T02:30", "America/New_York")).toThrow();
  });
});
