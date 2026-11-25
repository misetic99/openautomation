import { describe, expect, it } from "vitest";
import { emptyProject } from "./index.js";

describe("core", () => {
  it("creates an empty project model", () => {
    expect(emptyProject()).toEqual({ schemaVersion: 1, blocks: [], tagTables: [] });
  });
});
