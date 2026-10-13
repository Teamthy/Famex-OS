import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    pool: "threads",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    // These are pure unit tests with a mocked Prisma — they run in ~6s total on
    // a warm machine. The default 5s ceiling is not measuring the code, it is
    // measuring the machine: on a Windows box with Defender scanning
    // node_modules the same suite spent 741s in transform alone and 81 tests
    // timed out with zero assertion failures. A generous ceiling still fails
    // fast on a genuine hang while not flagging a slow disk as a broken test.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "app/api/**/*.ts"],
      exclude: ["**/node_modules/**", "**/*.d.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
