import { describe, it, expect } from "vitest";
import { Colors } from "../../mobile/src/theme/colors";
import { Spacing } from "../../mobile/src/theme/spacing";
import { Radius } from "../../mobile/src/theme/radius";

/**
 * The mobile design-system tokens are pure data (no React Native imports), so
 * they can be exercised under the repo's root vitest — no native test harness
 * needed. These pin the Ykay palette and spacing that every screen reads from
 * the shared theme, so a token regression is caught here rather than showing up
 * as a wrong color in a screenshot.
 */
describe("mobile design tokens", () => {
  it("exposes the brand palette", () => {
    expect(typeof Colors.brand.green).toBe("string");
    expect(typeof Colors.brand.greenDark).toBe("string");
    expect(typeof Colors.brand.orange).toBe("string");
    expect(typeof Colors.brand.navy).toBe("string");
  });

  it("brand green is a valid hex color", () => {
    expect(Colors.brand.green).toMatch(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  });

  it("spacing is strictly increasing", () => {
    const keys = ["xs", "sm", "md", "lg", "xl", "xxl"] as const;
    const vals = keys.map((k) => Spacing[k]);
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]).toBeGreaterThan(vals[i - 1]);
    }
  });

  it("radius has the expected keys", () => {
    expect(typeof Radius.xs).toBe("number");
    expect(typeof Radius.md).toBe("number");
    expect(typeof Radius.round).toBe("number");
  });

  it("all colors are strings (no undefined tokens)", () => {
    for (const [section, val] of Object.entries(Colors)) {
      for (const [name, v] of Object.entries(val as Record<string, unknown>)) {
        expect(typeof v, `${section}.${name}`).toBe("string");
      }
    }
  });
});
