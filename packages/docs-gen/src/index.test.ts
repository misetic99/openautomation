import { describe, expect, it } from "vitest";
import { emptyProject } from "@openautomation/core";
import { generateDocs } from "./index.js";

describe("docs-gen", () => {
  it("is a placeholder until implemented", () => {
    expect(() => generateDocs(emptyProject())).toThrow("not implemented");
  });
});
