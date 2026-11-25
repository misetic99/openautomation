import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (p: string) => fileURLToPath(new URL(`./packages/${p}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@openautomation/core": src("core"),
      "@openautomation/render": src("render"),
      "@openautomation/diff": src("diff"),
      "@openautomation/lint": src("lint"),
      "@openautomation/docs-gen": src("docs-gen"),
    },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts", "packages/*/test/**/*.test.ts"],
  },
});
