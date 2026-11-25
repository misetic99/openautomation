import { describe, expect, it } from "vitest";
import { emptyProject } from "@openautomation/core";
import { diffProjects } from "./index.js";

describe("diff", () => {
  it("is a placeholder until implemented", () => {
    expect(() => diffProjects(emptyProject())).toThrow("not implemented");
  });
});
