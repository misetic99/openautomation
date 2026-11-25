import { describe, expect, it } from "vitest";
import { emptyProject } from "@openautomation/core";
import { lintProject } from "./index.js";

describe("lint", () => {
  it("is a placeholder until implemented", () => {
    expect(() => lintProject(emptyProject())).toThrow("not implemented");
  });
});
