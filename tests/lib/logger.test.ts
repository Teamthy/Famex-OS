import { describe, it, expect, vi } from "vitest";
import { logger } from "@/lib/logger";

describe("logger", () => {
  it("logs info as JSON", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("test message", { key: "value" });

    expect(spy).toHaveBeenCalledOnce();
    const output = JSON.parse(spy.mock.calls[0][0]);
    expect(output.level).toBe("info");
    expect(output.message).toBe("test message");
    expect(output.key).toBe("value");
    expect(output.timestamp).toBeTruthy();

    spy.mockRestore();
  });

  it("logs errors to console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("something broke", { error: "details" });

    expect(spy).toHaveBeenCalledOnce();
    const output = JSON.parse(spy.mock.calls[0][0]);
    expect(output.level).toBe("error");
    expect(output.message).toBe("something broke");

    spy.mockRestore();
  });

  it("logs warnings to console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.warn("heads up");

    expect(spy).toHaveBeenCalledOnce();
    const output = JSON.parse(spy.mock.calls[0][0]);
    expect(output.level).toBe("warn");

    spy.mockRestore();
  });

  it("suppresses debug in production", () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = "production";

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.debug("should not appear");
    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
    (process.env as any).NODE_ENV = originalEnv;
  });
});
