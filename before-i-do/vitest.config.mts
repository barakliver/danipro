import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: { "server-only": fileURLToPath(new URL("./tests/unit/server-only-stub.ts", import.meta.url)) },
  },
  test: { include: ["tests/unit/**/*.test.ts"], environment: "node" },
});
