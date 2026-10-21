import { describe, expect, it } from "vitest";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  extractTemplateVariables,
  renderTemplateText,
} from "@/lib/message-templates";

/**
 * Template rendering is strict on purpose: "Dear , your balance is" must be
 * an error at queue time, never a message a parent receives.
 */
describe("template variables", () => {
  it("extracts unique variables in sorted order", () => {
    expect(extractTemplateVariables("Hi {{name}}, {{ name }} owes {{balance}}")).toEqual([
      "balance",
      "name",
    ]);
    expect(extractTemplateVariables("no variables here")).toEqual([]);
  });

  it("renders strings and numbers, repeatedly if needed", () => {
    expect(
      renderTemplateText("{{name}} owes {{amount}} ({{name}})", { name: "Ada", amount: 500 }),
    ).toBe("Ada owes 500 (Ada)");
  });

  it("throws when a variable is missing or empty", () => {
    expect(() => renderTemplateText("Hi {{name}}", {})).toThrow(/not supplied/);
    expect(() => renderTemplateText("Hi {{name}}", { name: "" })).toThrow(/not supplied/);
  });
});

describe("starter templates", () => {
  it("are unique per (key, channel) and fully variable-declared", () => {
    const pairs = DEFAULT_MESSAGE_TEMPLATES.map((t) => `${t.key}:${t.channel}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    for (const template of DEFAULT_MESSAGE_TEMPLATES) {
      const vars = new Set([
        ...extractTemplateVariables(template.subject),
        ...extractTemplateVariables(template.body),
      ]);
      expect(vars.size).toBeGreaterThan(0);
      // Every starter template personalises with the school name.
      expect(vars.has("schoolName")).toBe(true);
    }
  });
});
