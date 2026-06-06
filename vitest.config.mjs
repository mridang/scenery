import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    root: "./",
    include: ["src/**/*.test.ts"],
    coverage: {
      include: ["src/lib/**"],
      exclude: ["src/lib/**/*.test.ts"],
    },
  },
});
