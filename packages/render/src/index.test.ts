import { describe, expect, it } from "vitest";
import { emptyProject } from "@openautomation/core";
import { renderBlock } from "./index.js";

describe("render", () => {
  it("is a placeholder until implemented", () => {
    expect(() => renderBlock(emptyProject())).toThrow("not implemented");
  });
});
