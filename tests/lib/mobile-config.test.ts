import { describe, it, expect } from "vitest";
import { isOlderThan } from "@/lib/app-version";

/**
 * Minimum supported app version.
 *
 * Ykay distributes the Android app as a sideloaded APK, not through the Play
 * Store. Nothing nags a stale install, an APK forwarded on WhatsApp can be
 * installed months later, and OTA updates replace JavaScript only — so a build
 * whose NATIVE layer is too old cannot be rescued over the air.
 *
 * This comparison is the only thing standing between that and an old install
 * failing in confusing ways against an API that has moved on. A naive string
 * compare gets it wrong at exactly the wrong moment: "1.10.0" < "1.9.0" is
 * true alphabetically, which would lock out the NEWEST users.
 */

describe("isOlderThan", () => {
  it("accepts a build that exactly meets the minimum", () => {
    expect(isOlderThan("1.0.0", "1.0.0")).toBe(false);
  });

  it("rejects a genuinely older build", () => {
    expect(isOlderThan("1.0.0", "1.1.0")).toBe(true);
    expect(isOlderThan("1.0.9", "1.1.0")).toBe(true);
    expect(isOlderThan("0.9.0", "1.0.0")).toBe(true);
  });

  it("accepts anything newer", () => {
    expect(isOlderThan("1.2.0", "1.1.0")).toBe(false);
    expect(isOlderThan("2.0.0", "1.9.9")).toBe(false);
  });

  it("compares numerically, not alphabetically", () => {
    // The bug that matters: "1.10.0" sorts BEFORE "1.9.0" as a string, so a
    // string compare would lock out the newest users while letting old ones in.
    expect(isOlderThan("1.10.0", "1.9.0")).toBe(false);
    expect(isOlderThan("1.9.0", "1.10.0")).toBe(true);
    expect(isOlderThan("2.0.0", "1.10.0")).toBe(false);
  });

  it("treats a missing segment as zero", () => {
    expect(isOlderThan("1.0", "1.0.0")).toBe(false);
    expect(isOlderThan("1", "1.0.1")).toBe(true);
    expect(isOlderThan("1.1", "1.0.5")).toBe(false);
  });

  it("fails OPEN on a malformed version rather than locking the user out", () => {
    // A garbled version parses to 0.0.0, which IS older — but the important
    // case is that it does not throw and take the whole app down with it.
    expect(() => isOlderThan("not-a-version", "1.0.0")).not.toThrow();
    expect(() => isOlderThan("", "1.0.0")).not.toThrow();
  });

  it("handles a four-part version without truncating", () => {
    expect(isOlderThan("1.0.0.1", "1.0.0.2")).toBe(true);
    expect(isOlderThan("1.0.0.3", "1.0.0.2")).toBe(false);
  });

  it("is not fooled by leading zeroes", () => {
    expect(isOlderThan("1.02.0", "1.2.0")).toBe(false);
    expect(isOlderThan("1.01.0", "1.2.0")).toBe(true);
  });
});
